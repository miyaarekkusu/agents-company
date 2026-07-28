"""役割: 会議・作業の完了/失敗を社長に知らせるメール通知。

`email_threads`/`email_messages`テーブル（`DATABASE.md`に定義済みだったが未実装だった）を、
「エージェントが完了/失敗を社長に一方向で知らせる」用途で使う（返信機能は対象外。
`app/services/meetings.py`の`finish_meeting`、`app/services/work.py`の`finish_work`から呼ばれる）。
"""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email import EmailMessage, EmailThread


async def notify(
    session: AsyncSession, *, task_id: int, agent_id: int, subject: str, body: str
) -> None:
    """お題に紐づく通知メール（未読）を1件作成する。呼び出し側でcommitすること。"""
    thread = EmailThread(task_id=task_id, agent_id=agent_id, subject=subject, status="open")
    session.add(thread)
    await session.flush()
    session.add(
        EmailMessage(thread_id=thread.id, direction="outbound", sender_agent_id=agent_id, body=body)
    )


async def count_unread(session: AsyncSession) -> int:
    """未読（`status == "open"`）の通知件数を返す。"""
    result = await session.scalars(select(EmailThread.id).where(EmailThread.status == "open"))
    return len(result.all())


@dataclass
class NotificationView:
    """表示用に、通知（EmailThread）と本文（最初のEmailMessage）をまとめたもの。"""

    thread: EmailThread
    body: str


async def list_notifications(session: AsyncSession) -> list[NotificationView]:
    """通知一覧を、新しい順に返す（本文付き）。"""
    threads = (
        await session.scalars(select(EmailThread).order_by(EmailThread.created_at.desc()))
    ).all()
    if not threads:
        return []

    thread_ids = [t.id for t in threads]
    messages = (
        await session.scalars(
            select(EmailMessage).where(EmailMessage.thread_id.in_(thread_ids))
        )
    ).all()
    body_by_thread_id = {m.thread_id: m.body for m in messages}

    return [
        NotificationView(thread=t, body=body_by_thread_id.get(t.id, ""))
        for t in threads
    ]


async def mark_read(session: AsyncSession, thread_id: int) -> None:
    """通知を既読にする（`EmailThread.status`を`closed`に更新してcommitする）。"""
    thread = await session.get(EmailThread, thread_id)
    if thread is None:
        raise ValueError(f"未登録のthread_idです: {thread_id}")
    thread.status = "closed"
    await session.commit()
