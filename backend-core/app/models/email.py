"""役割: メール関連テーブル（`email_threads`/`email_messages`）のORMモデル。

エージェントが確認・質問事項を送信し（outbound）、社長がメール返信で応答する（inbound）
やり取りを表す。実際のメール送受信システム連携は別タスク。詳細は`DATABASE.md`参照。
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EmailThread(Base):
    __tablename__ = "email_threads"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    """質問した側のエージェント"""
    subject: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="open")
    """open / closed"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    thread_id: Mapped[int] = mapped_column(ForeignKey("email_threads.id"))
    direction: Mapped[str] = mapped_column(String(20))
    """outbound(エージェント→社長) / inbound(社長→エージェント)"""
    sender_agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    """inboundの場合はnull"""
    body: Mapped[str] = mapped_column(String)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
