"""役割: メール（通知）関連のAPIルーター。HTTPの入出力(Pydanticスキーマ)と`app/services/notifications.py`をつなぐ薄い層。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.mail import NotificationOut
from app.services import notifications

router = APIRouter()


@router.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(session: AsyncSession = Depends(get_db)) -> list[NotificationOut]:
    """通知一覧を、新しい順に返す（本文付き）。"""
    items = await notifications.list_notifications(session)
    return [
        NotificationOut(
            id=item.thread.id,
            task_id=item.thread.task_id,
            agent_id=item.thread.agent_id,
            subject=item.thread.subject,
            status=item.thread.status,
            body=item.body,
            created_at=item.thread.created_at,
        )
        for item in items
    ]


@router.post("/notifications/{thread_id}/read", status_code=204)
async def mark_notification_read(thread_id: int, session: AsyncSession = Depends(get_db)) -> None:
    """通知を既読にする。"""
    try:
        await notifications.mark_read(session, thread_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
