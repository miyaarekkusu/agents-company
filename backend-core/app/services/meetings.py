"""役割: 会議室（`meetings`/`meeting_participants`/`meeting_proposals`/`meeting_reports`）のDB永続化・
オーケストレーション層。

`app/services/meeting_graph.py`はLLM呼び出しロジックのみを担当するため、DBへの保存（Meeting/
MeetingParticipant/MeetingProposal/MeetingReportの作成、Meeting.statusの更新）はこちらで行う。
「会議室は1つのみのため、同時に進行できる会議は常に1件まで」という制約も、DB制約ではなく
ここでアプリケーション側のロジックとして担保する（`DATABASE.md`参照）。

会議で話し合うお題は、会議室でその場に入力するのではなく、**社長室で登録済みの`Task`のうち
`requires_meeting=True`かつ会議未実施（`status == "awaiting_meeting"`）のものから選ぶ**
（`app/services/work.py`の`list_awaiting_meeting_tasks`参照）。そのため`start_meeting`は新規に
`Task`を作成せず、既存の`task_id`を受け取って参照する。

会議は「予約（`start_meeting`）→ バックグラウンド実行（`finish_meeting`）」の2段階に分かれている
（LLM呼び出しに時間がかかるため、社長がその間も他の操作を続けられるようにするため。
`backend-core/scripts/game_cli.py`が`start_meeting`をフォアグラウンドで`await`した直後に
`asyncio.create_task(finish_meeting(meeting.id))`でバックグラウンド化する）。

会議が完了しても、お題の状態はすぐに`completed`にはならない。まずレポートが作成された
`awaiting_approval`状態になり、社長が`approve_report`で承認して初めて`ready_for_work`
（作業を割り当てられる状態）に進む（`app/services/work.py`参照）。
"""
from datetime import UTC, datetime
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.agent import Agent
from app.models.meeting import Meeting, MeetingParticipant, MeetingProposal, MeetingReport
from app.models.task import Task
from app.services.availability import list_busy_agent_ids
from app.services.meeting_graph import meeting_graph
from app.services.notifications import notify


async def has_in_progress_meeting(session: AsyncSession) -> bool:
    """`meetings.status == "in_progress"`の行が存在するか確認する。

    会議室は1つのみのため、同時に進行できる会議は常に1件までという制約を
    ここでアプリケーション側として担保する（DB制約は使わない）。
    """
    result = await session.scalars(
        select(Meeting.id).where(Meeting.status == "in_progress").limit(1)
    )
    return result.first() is not None


async def start_meeting(
    session: AsyncSession,
    *,
    task_id: int,
    leader_agent_id: int,
    participant_agent_ids: list[int],
) -> Meeting:
    """社長室で登録済みのお題(`task_id`)について、会議を予約する（予約フェーズ）。

    1. `has_in_progress_meeting`を確認し、Trueなら例外（進行中の会議が既にある）を送出する。
    2. `task_id`に対応する`Task`をDBから取得する。未登録、または`requires_meeting=False`、
       または`status`が`awaiting_meeting`以外（会議不要・会議中・会議済み等）の場合は
       `ValueError`を送出する。
    3. 参加者・リーダーの中に、既に別の会議・作業で進行中（busy）のエージェントがいないか確認する
       （`app/services/availability.py`）。いれば`ValueError`を送出する。
    4. `Meeting`行（`status="in_progress"`）と、リーダーを含む全参加者分の`MeetingParticipant`行を
       作成し、`Task.status`を`"meeting_in_progress"`に更新してコミットする。

    実際のLLM呼び出し・レポート作成は`finish_meeting`（バックグラウンド実行）が担当する。
    """
    if await has_in_progress_meeting(session):
        raise RuntimeError("既に進行中の会議があります。会議室は1つのみのため、同時に進行できません。")

    task = await session.get(Task, task_id)
    if task is None:
        raise ValueError(f"未登録のtask_idです: {task_id}")
    if not task.requires_meeting or task.status != "awaiting_meeting":
        raise ValueError(
            f"このお題は会議室での話し合い対象ではありません（現在の状態: {task.status}）。"
        )

    # リーダーを含む全参加者のagent_id（重複除去。順序は保持する）。
    all_participant_ids: list[int] = []
    for agent_id in [*participant_agent_ids, leader_agent_id]:
        if agent_id not in all_participant_ids:
            all_participant_ids.append(agent_id)

    busy_agent_ids = await list_busy_agent_ids(session)
    if busy_agent_ids & set(all_participant_ids):
        raise ValueError("選ばれた中に、既に会議中・作業中のエージェントが含まれています。")

    meeting = Meeting(task_id=task.id, leader_agent_id=leader_agent_id, status="in_progress")
    session.add(meeting)
    await session.flush()  # meeting.idを確定させる

    for agent_id in all_participant_ids:
        session.add(MeetingParticipant(meeting_id=meeting.id, agent_id=agent_id))

    task.status = "meeting_in_progress"
    await session.commit()
    await session.refresh(meeting)
    return meeting


async def finish_meeting(meeting_id: int) -> None:
    """予約済みの会議を実行し、DBに記録する（バックグラウンドタスクから呼ばれる想定）。

    `start_meeting`とは別に、**新しいセッションを内部で開く**（`asyncio.create_task`で
    フォアグラウンドの処理と並行して動くため、既存セッションを使い回せない）。

    1. `app.services.meeting_graph.meeting_graph`に、DBから取得した`Agent`一覧（`ai_model`を
       ロード済みで）を渡して呼び出し、各参加者の提案とリーダーのレポートを取得する。
    2. 成功時: `MeetingProposal`行（参加者ごと）と`MeetingReport`行（1件）を作成し、
       `Meeting.status`を`"completed"`に、`Task.status`を`"awaiting_approval"`に更新する
       （社長がレポートを承認するまで作業は始まらない。`approve_report`参照）。完了を知らせる
       通知メールを作成してコミットする。
    3. 失敗時（LLM呼び出しエラー等）: `Meeting.status`を`"failed"`に、`Task.status`を
       `"awaiting_meeting"`に戻す（やり直せるようにする）。失敗を知らせる通知メールを作成して
       コミットする。
    """
    async with AsyncSessionLocal() as session:
        meeting = await session.get(Meeting, meeting_id)
        if meeting is None:
            return
        task = await session.get(Task, meeting.task_id)
        if task is None:
            return

        participant_ids = (
            await session.scalars(
                select(MeetingParticipant.agent_id).where(MeetingParticipant.meeting_id == meeting_id)
            )
        ).all()
        agents_result = await session.scalars(
            select(Agent).where(Agent.id.in_(participant_ids)).options(selectinload(Agent.ai_model))
        )
        agents_by_id = {agent.id: agent for agent in agents_result.all()}
        participants = [agents_by_id[agent_id] for agent_id in participant_ids]
        leader = agents_by_id[meeting.leader_agent_id]

        try:
            state = await meeting_graph.ainvoke(
                {
                    "task": task.description,
                    "participants": participants,
                    "leader": leader,
                    "proposals": [],
                    "report": "",
                }
            )
        except Exception as exc:  # noqa: BLE001
            meeting.status = "failed"
            task.status = "awaiting_meeting"
            await notify(
                session,
                task_id=task.id,
                agent_id=leader.id,
                subject=f"会議でエラーが発生しました：{task.title}",
                body=(
                    f"「{task.title}」の会議中にエラーが発生したため中断しました（{exc}）。"
                    "会議室からもう一度話し合いを開始してください。"
                ),
            )
            await session.commit()
            return

        for agent, content in state["proposals"]:
            session.add(MeetingProposal(meeting_id=meeting.id, agent_id=agent.id, content=content))
        session.add(MeetingReport(meeting_id=meeting.id, content=state["report"]))

        meeting.status = "completed"
        task.status = "awaiting_approval"
        await notify(
            session,
            task_id=task.id,
            agent_id=leader.id,
            subject=f"会議が完了しました：{task.title}",
            body=(
                f"「{task.title}」の会議が完了し、以下のレポートが作成されました。\n\n"
                f"--- 会議レポート ---\n{state['report']}\n\n"
                "内容を確認の上、社長室の「レポートを確認して承認する」から承認してください。"
            ),
        )
        await session.commit()


@dataclass
class PendingReport:
    """承認待ちの会議レポート1件分（`list_reports_pending_approval`の返り値）。"""

    task: Task
    meeting: Meeting
    report: MeetingReport


async def list_reports_pending_approval(session: AsyncSession) -> list[PendingReport]:
    """社長の承認待ち（`Task.status == "awaiting_approval"`）の会議レポート一覧を返す。"""
    stmt = (
        select(Task, Meeting, MeetingReport)
        .join(Meeting, Meeting.task_id == Task.id)
        .join(MeetingReport, MeetingReport.meeting_id == Meeting.id)
        .where(Task.status == "awaiting_approval")
        .order_by(Task.created_at.desc())
    )
    result = await session.execute(stmt)
    return [PendingReport(task=t, meeting=m, report=r) for t, m, r in result.all()]


async def approve_report(session: AsyncSession, *, task_id: int) -> None:
    """会議レポートを承認し、お題を作業割り当て可能な状態(`ready_for_work`)にする。

    お題が承認待ち状態でない場合、またはレポートが見つからない場合は`ValueError`を送出する。
    """
    task = await session.get(Task, task_id)
    if task is None or task.status != "awaiting_approval":
        raise ValueError("承認待ちのお題が見つかりません。")

    report = await session.scalar(
        select(MeetingReport)
        .join(Meeting, Meeting.id == MeetingReport.meeting_id)
        .where(Meeting.task_id == task_id)
    )
    if report is None:
        raise ValueError("このお題に紐づく会議レポートが見つかりません。")

    report.approved_at = datetime.now(UTC)
    task.status = "ready_for_work"
    await session.commit()
