"""役割: 「社長室」でのお題登録・作業割り当て・成果物閲覧ロジック。

お題（`Task`）は次の状態遷移で管理する（`Task.status`）。
  - `awaiting_meeting`: `requires_meeting=True`で作成。会議室での話し合い待ち。
  - `meeting_in_progress`: 会議がバックグラウンドで進行中（`app/services/meetings.py`が管理）。
  - `awaiting_approval`: 会議が完了しレポートができたが、社長が未承認
    （`app/services/meetings.py`が管理）。
  - `ready_for_work`: `requires_meeting=False`で作成された直後、または会議レポートが
    承認された後。`start_work`で作業を割り当てられる。
  - `work_in_progress`: 作業がバックグラウンドで進行中。
  - `completed`: 単一の成果物(Artifact)が作成済み。

1つのお題につき成果物は**1件だけ**。複数のエージェント（worker）がタスクの役割分担を
決めて協力し、リーダーが最終的な成果物として統合する。作業は「予約（`start_work`）→
バックグラウンド実行（`finish_work`）」の2段階に分かれている（会議と同じ構成。
`backend-core/scripts/game_cli.py`が`start_work`をフォアグラウンドで`await`した直後に
`asyncio.create_task(finish_work(session.id))`でバックグラウンド化する）。実処理は
`app/services/work_graph.py`に委譲する。

`call_llm`は`app/services/llm.py`の非同期関数（シグネチャ:
`call_llm(agent: Agent, prompt: str) -> str`。`agent.ai_model.provider`が"deepseek"なら
実際にLLMを呼び、それ以外は`NotImplementedError`を送出する）。
"""
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.agent import Agent
from app.models.artifact import Artifact
from app.models.email import EmailMessage, EmailThread
from app.models.meeting import Meeting, MeetingParticipant, MeetingProposal, MeetingReport
from app.models.task import Task
from app.models.work_session import WorkSession, WorkSessionParticipant
from app.services.availability import list_busy_agent_ids
from app.services.notifications import notify
from app.services.work_graph import work_graph

_TASK_TITLE_MAX_LEN = 200

_IN_PROGRESS_STATUSES = ("meeting_in_progress", "work_in_progress")


async def create_task(session: AsyncSession, *, task_text: str, requires_meeting: bool) -> Task:
    """お題(Task)を登録する。

    `requires_meeting=True`なら会議室での話し合いが必要な状態（`awaiting_meeting`）で、
    `False`ならすぐに作業を割り当てられる状態（`ready_for_work`）で作成する。
    """
    status = "awaiting_meeting" if requires_meeting else "ready_for_work"
    task = Task(
        title=task_text[:_TASK_TITLE_MAX_LEN],
        description=task_text,
        status=status,
        requires_meeting=requires_meeting,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


async def list_tasks(session: AsyncSession) -> Sequence[Task]:
    """登録済みのお題一覧を、作成日時の新しい順に返す。"""
    result = await session.scalars(select(Task).order_by(Task.created_at.desc()))
    return result.all()


async def list_awaiting_meeting_tasks(session: AsyncSession) -> Sequence[Task]:
    """会議室での話し合いがまだのお題（`awaiting_meeting`）一覧を返す。

    会議室（`app/services/meetings.py`）が「話し合うお題」を選ぶ際に使う。
    """
    result = await session.scalars(
        select(Task).where(Task.status == "awaiting_meeting").order_by(Task.created_at.desc())
    )
    return result.all()


async def list_ready_for_work_tasks(session: AsyncSession) -> Sequence[Task]:
    """作業を割り当てられる状態のお題（`ready_for_work`）一覧を返す。"""
    result = await session.scalars(
        select(Task).where(Task.status == "ready_for_work").order_by(Task.created_at.desc())
    )
    return result.all()


async def update_task(
    session: AsyncSession,
    *,
    task_id: int,
    task_text: str | None = None,
    requires_meeting: bool | None = None,
) -> Task:
    """お題の内容・会議要否を編集する（指定した項目だけ更新する部分更新）。

    完了済み（`completed`）、または会議・作業がバックグラウンドで進行中
    （`meeting_in_progress`/`work_in_progress`）のお題は編集できない。また、既に会議が
    行われた（`meetings`行が存在する）お題の会議要否は変更できない（話し合い済みの実績と
    矛盾する状態遷移を防ぐため）。会議要否を変更した場合、状態も合わせて
    `awaiting_meeting`/`ready_for_work`に更新する。
    """
    task = await session.get(Task, task_id)
    if task is None:
        raise ValueError(f"未登録のtask_idです: {task_id}")
    if task.status == "completed" or task.status in _IN_PROGRESS_STATUSES:
        raise ValueError(f"このお題は編集できません（現在の状態: {task.status}）。")

    if task_text is not None:
        task.title = task_text[:_TASK_TITLE_MAX_LEN]
        task.description = task_text

    if requires_meeting is not None and requires_meeting != task.requires_meeting:
        has_meeting = await session.scalar(
            select(Meeting.id).where(Meeting.task_id == task_id).limit(1)
        )
        if has_meeting is not None:
            raise ValueError("既に会議が行われたお題の会議要否は変更できません。")
        task.requires_meeting = requires_meeting
        task.status = "awaiting_meeting" if requires_meeting else "ready_for_work"

    await session.commit()
    await session.refresh(task)
    return task


async def delete_task(session: AsyncSession, task_id: int) -> None:
    """お題を削除する。紐づく会議・作業・成果物・メール等も整合性を保つため合わせて削除する。

    会議・作業がバックグラウンドで進行中（`meeting_in_progress`/`work_in_progress`）のお題は
    削除できない（進行中のバックグラウンド処理が、削除済みの行を参照して失敗するのを防ぐため）。

    `tasks`を参照する行（`meetings`とその子テーブル・`work_sessions`とその子テーブル・
    `artifacts`・`email_threads`とその子テーブル）を先に削除してから、お題本体を削除する
    （外部キー制約違反を防ぐため）。
    """
    task = await session.get(Task, task_id)
    if task is None:
        raise ValueError(f"未登録のtask_idです: {task_id}")
    if task.status in _IN_PROGRESS_STATUSES:
        raise ValueError(f"進行中のお題は削除できません（現在の状態: {task.status}）。")

    meeting_ids = (
        await session.scalars(select(Meeting.id).where(Meeting.task_id == task_id))
    ).all()
    if meeting_ids:
        await session.execute(delete(MeetingProposal).where(MeetingProposal.meeting_id.in_(meeting_ids)))
        await session.execute(delete(MeetingReport).where(MeetingReport.meeting_id.in_(meeting_ids)))
        await session.execute(delete(MeetingParticipant).where(MeetingParticipant.meeting_id.in_(meeting_ids)))
        await session.execute(delete(Meeting).where(Meeting.id.in_(meeting_ids)))

    work_session_ids = (
        await session.scalars(select(WorkSession.id).where(WorkSession.task_id == task_id))
    ).all()
    if work_session_ids:
        await session.execute(
            delete(WorkSessionParticipant).where(WorkSessionParticipant.work_session_id.in_(work_session_ids))
        )
        await session.execute(delete(WorkSession).where(WorkSession.id.in_(work_session_ids)))

    thread_ids = (
        await session.scalars(select(EmailThread.id).where(EmailThread.task_id == task_id))
    ).all()
    if thread_ids:
        await session.execute(delete(EmailMessage).where(EmailMessage.thread_id.in_(thread_ids)))
        await session.execute(delete(EmailThread).where(EmailThread.id.in_(thread_ids)))

    await session.execute(delete(Artifact).where(Artifact.task_id == task_id))
    await session.delete(task)
    await session.commit()


async def has_in_progress_work(session: AsyncSession) -> bool:
    """`work_sessions.status == "in_progress"`の行が存在するか確認する（作業室の使用中表示用）。

    会議と違い、作業の同時進行数に制限はない（`start_work`参照）。ここでは「作業室が
    使用中かどうか」の表示（`scripts/game_cli.py`）のためだけに使う。
    """
    result = await session.scalars(
        select(WorkSession.id).where(WorkSession.status == "in_progress").limit(1)
    )
    return result.first() is not None


async def start_work(
    session: AsyncSession, *, task_id: int, worker_agent_ids: list[int], leader_agent_id: int
) -> WorkSession:
    """登録済みのお題に、担当者（worker）とリーダーを割り当てて作業を予約する（予約フェーズ）。

    1. お題の状態が`ready_for_work`であることを確認する（会議が必要なのに未承認、
       等の場合は`ValueError`）。
    2. worker・リーダーの中に、既に別の会議・作業で進行中（busy）のエージェントがいないか
       確認する（`app/services/availability.py`）。いれば`ValueError`を送出する。
    3. `WorkSession`行（`status="in_progress"`）と、リーダーを含む全workerの
       `WorkSessionParticipant`行を作成し、`Task.status`を`"work_in_progress"`に更新して
       コミットする。

    実際のLLM呼び出し・成果物作成は`finish_work`（バックグラウンド実行）が担当する。
    """
    task = await session.get(Task, task_id)
    if task is None:
        raise ValueError(f"未登録のtask_idです: {task_id}")
    if task.status != "ready_for_work":
        raise ValueError(f"このお題はまだ作業を開始できません（現在の状態: {task.status}）。")

    all_worker_ids: list[int] = []
    for agent_id in [*worker_agent_ids, leader_agent_id]:
        if agent_id not in all_worker_ids:
            all_worker_ids.append(agent_id)

    busy_agent_ids = await list_busy_agent_ids(session)
    if busy_agent_ids & set(all_worker_ids):
        raise ValueError("選ばれた中に、既に会議中・作業中のエージェントが含まれています。")

    work_session = WorkSession(task_id=task.id, leader_agent_id=leader_agent_id, status="in_progress")
    session.add(work_session)
    await session.flush()  # work_session.idを確定させる

    for agent_id in all_worker_ids:
        session.add(WorkSessionParticipant(work_session_id=work_session.id, agent_id=agent_id))

    task.status = "work_in_progress"
    await session.commit()
    await session.refresh(work_session)
    return work_session


async def finish_work(work_session_id: int) -> None:
    """予約済みの作業を実行し、DBに記録する（バックグラウンドタスクから呼ばれる想定）。

    `start_work`とは別に、**新しいセッションを内部で開く**（`asyncio.create_task`で
    フォアグラウンドの処理と並行して動くため、既存セッションを使い回せない）。

    1. そのお題に会議レポートが紐づいていれば内容を取得する（無ければ`None`）。
    2. `work_graph`を呼び、各workerの担当分をリーダーが1つの成果物に統合させる。
    3. 成功時: `Artifact`を1件だけ作成し（`created_by_agent_id`はリーダー）、
       `WorkSession.status`を`"completed"`に、お題の状態を`"completed"`に更新する。
       完了を知らせる通知メールを作成してコミットする。
    4. 失敗時: `WorkSession.status`を`"failed"`に、`Task.status`を`"ready_for_work"`に戻す
       （やり直せるようにする）。失敗を知らせる通知メールを作成してコミットする。
    """
    async with AsyncSessionLocal() as session:
        work_session = await session.get(WorkSession, work_session_id)
        if work_session is None:
            return
        task = await session.get(Task, work_session.task_id)
        if task is None:
            return

        worker_ids = (
            await session.scalars(
                select(WorkSessionParticipant.agent_id).where(
                    WorkSessionParticipant.work_session_id == work_session_id
                )
            )
        ).all()
        agents_result = await session.scalars(
            select(Agent).where(Agent.id.in_(worker_ids)).options(selectinload(Agent.ai_model))
        )
        agents_by_id = {agent.id: agent for agent in agents_result.all()}
        workers = [agents_by_id[agent_id] for agent_id in worker_ids]
        leader = agents_by_id[work_session.leader_agent_id]

        report_content = await session.scalar(
            select(MeetingReport.content)
            .join(Meeting, Meeting.id == MeetingReport.meeting_id)
            .where(Meeting.task_id == task.id)
        )

        try:
            state = await work_graph.ainvoke(
                {
                    "task": task.description,
                    "report": report_content,
                    "workers": workers,
                    "leader": leader,
                    "contributions": [],
                    "final_content": "",
                }
            )
        except Exception as exc:  # noqa: BLE001
            work_session.status = "failed"
            task.status = "ready_for_work"
            await notify(
                session,
                task_id=task.id,
                agent_id=leader.id,
                subject=f"作業でエラーが発生しました：{task.title}",
                body=(
                    f"「{task.title}」の作業中にエラーが発生したため中断しました（{exc}）。"
                    "社長室の「作業を割り当てる」からもう一度やり直してください。"
                ),
            )
            await session.commit()
            return

        artifact = Artifact(
            task_id=task.id,
            type="proposal",
            content=state["final_content"],
            created_by_agent_id=leader.id,
        )
        session.add(artifact)
        work_session.status = "completed"
        task.status = "completed"
        await notify(
            session,
            task_id=task.id,
            agent_id=leader.id,
            subject=f"作業が完了しました：{task.title}",
            body=f"「{task.title}」の作業が完了しました。作業室で成果物を確認できます。",
        )
        await session.commit()


@dataclass
class ArtifactView:
    """表示用に、Artifactと関連するTask/Agentの情報をまとめたもの。

    `Artifact`にはTask/Agentへの`relationship`が現状定義されていない（既存モデルは未変更のまま）
    ため、ここで個別に引いた`Task.title`/`Agent.name`を添えて返す。
    """

    artifact: Artifact
    task_title: str | None
    agent_name: str | None


async def list_artifacts(session: AsyncSession) -> Sequence[ArtifactView]:
    """作成日時の新しい順にArtifact一覧を返す（表示用のTask/Agent情報付き）。

    「いつ・誰が・どのお題を」をCLI側で表示できるよう、各Artifactに紐づく
    `Task.title`・`Agent.name`をまとめて取得して添える。
    """
    result = await session.scalars(select(Artifact).order_by(Artifact.created_at.desc()))
    artifacts = result.all()

    task_ids = {a.task_id for a in artifacts}
    agent_ids = {a.created_by_agent_id for a in artifacts}

    tasks_by_id: dict[int, Task] = {}
    if task_ids:
        tasks = await session.scalars(select(Task).where(Task.id.in_(task_ids)))
        tasks_by_id = {t.id: t for t in tasks.all()}

    agents_by_id: dict[int, Agent] = {}
    if agent_ids:
        agents = await session.scalars(select(Agent).where(Agent.id.in_(agent_ids)))
        agents_by_id = {ag.id: ag for ag in agents.all()}

    return [
        ArtifactView(
            artifact=a,
            task_title=tasks_by_id[a.task_id].title if a.task_id in tasks_by_id else None,
            agent_name=(
                agents_by_id[a.created_by_agent_id].name
                if a.created_by_agent_id in agents_by_id
                else None
            ),
        )
        for a in artifacts
    ]
