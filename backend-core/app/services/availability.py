"""役割: エージェントの稼働状況（会議中・作業中で「busy」かどうか）を判定する。

会議室・作業室はバックグラウンドで進行するため、進行中の会議・作業に参加している
エージェントは、別のお題の会議・作業には二重に割り当てられないようにする必要がある
（`app/services/meetings.py`の`start_meeting`、`app/services/work.py`の`start_work`から
参照される想定。CLI側の参加者・担当者選択でもここでbusyなagent_idを除外する）。
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.meeting import Meeting, MeetingParticipant
from app.models.work_session import WorkSession, WorkSessionParticipant


async def list_busy_agent_ids(session: AsyncSession) -> set[int]:
    """現在、進行中（`in_progress`）の会議または作業に参加しているagent_idの集合を返す。"""
    meeting_agent_ids = await session.scalars(
        select(MeetingParticipant.agent_id)
        .join(Meeting, Meeting.id == MeetingParticipant.meeting_id)
        .where(Meeting.status == "in_progress")
    )
    work_agent_ids = await session.scalars(
        select(WorkSessionParticipant.agent_id)
        .join(WorkSession, WorkSession.id == WorkSessionParticipant.work_session_id)
        .where(WorkSession.status == "in_progress")
    )
    return set(meeting_agent_ids.all()) | set(work_agent_ids.all())


async def get_in_progress_agent_names(session: AsyncSession, task_id: int) -> list[str]:
    """指定したお題が現在会議中・作業中の場合、その担当エージェント名一覧を返す（無ければ空リスト）。"""
    meeting_names = await session.scalars(
        select(Agent.name)
        .join(MeetingParticipant, MeetingParticipant.agent_id == Agent.id)
        .join(Meeting, Meeting.id == MeetingParticipant.meeting_id)
        .where(Meeting.task_id == task_id, Meeting.status == "in_progress")
    )
    names = meeting_names.all()
    if names:
        return list(names)

    work_names = await session.scalars(
        select(Agent.name)
        .join(WorkSessionParticipant, WorkSessionParticipant.agent_id == Agent.id)
        .join(WorkSession, WorkSession.id == WorkSessionParticipant.work_session_id)
        .where(WorkSession.task_id == task_id, WorkSession.status == "in_progress")
    )
    return list(work_names.all())
