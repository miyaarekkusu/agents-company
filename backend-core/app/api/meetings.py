"""役割: 会議室関連のAPIルーター。HTTPの入出力(Pydanticスキーマ)と`app/services/meetings.py`をつなぐ薄い層。

会議は「予約（`start_meeting`）→ バックグラウンド実行（`finish_meeting`）」の2段階になっている。
LLM呼び出しに時間がかかるため、`finish_meeting`はHTTPレスポンスをブロックせず
`app/core/background.py`の`track_background`でバックグラウンド起動し、`await`しない。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.background import track_background
from app.core.database import get_db
from app.schemas.meeting import MeetingOut, MeetingStatusOut, PendingReportOut, StartMeetingRequest
from app.services import meetings

router = APIRouter()


@router.get("/meetings/status", response_model=MeetingStatusOut)
async def get_meeting_status(session: AsyncSession = Depends(get_db)) -> MeetingStatusOut:
    """会議室が使用中かどうかと、使用中の場合は進行中の会議のリーダー・参加者IDを返す。"""
    info = await meetings.get_active_meeting_info(session)
    if info is None:
        return MeetingStatusOut(busy=False)
    return MeetingStatusOut(
        busy=True,
        leader_agent_id=info.leader_agent_id,
        participant_agent_ids=info.participant_agent_ids,
    )


@router.post("/meetings", response_model=MeetingOut)
async def start_meeting(
    request: StartMeetingRequest, session: AsyncSession = Depends(get_db)
) -> MeetingOut:
    """会議を予約し、バックグラウンドで実行を開始する。"""
    try:
        meeting = await meetings.start_meeting(
            session,
            task_id=request.task_id,
            leader_agent_id=request.leader_agent_id,
            participant_agent_ids=request.participant_agent_ids,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    track_background(meetings.finish_meeting(meeting.id))

    return MeetingOut(
        id=meeting.id,
        task_id=meeting.task_id,
        leader_agent_id=meeting.leader_agent_id,
        status=meeting.status,
        created_at=meeting.created_at,
    )


@router.get("/meetings/pending-reports", response_model=list[PendingReportOut])
async def get_pending_reports(session: AsyncSession = Depends(get_db)) -> list[PendingReportOut]:
    """社長の承認待ちの会議レポート一覧を返す。"""
    pending = await meetings.list_reports_pending_approval(session)
    return [
        PendingReportOut(
            task_id=item.task.id,
            task_title=item.task.title,
            meeting_id=item.meeting.id,
            report_content=item.report.content,
            created_at=item.report.created_at,
        )
        for item in pending
    ]


@router.post("/meetings/{task_id}/approve", status_code=204)
async def approve_report(task_id: int, session: AsyncSession = Depends(get_db)) -> None:
    """会議レポートを承認し、お題を作業割り当て可能な状態にする。"""
    try:
        await meetings.approve_report(session, task_id=task_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
