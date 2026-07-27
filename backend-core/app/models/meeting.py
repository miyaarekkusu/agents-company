"""役割: 会議室関連テーブル（`meetings`/`meeting_participants`/`meeting_proposals`/`meeting_reports`）のORMモデル。

会議室は物理的に1つのみのため、「進行中の会議は常に1件まで」という制約はDBではなく
アプリケーション側のロジックで担保する方針（詳細は`DATABASE.md`参照）。
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    leader_agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    status: Mapped[str] = mapped_column(String(50), default="in_progress")
    """同時進行1件までの制約はアプリ側で担保する（DB制約は設けない）"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MeetingParticipant(Base):
    """`meetings`と`agents`の多対多中間テーブル（会議参加者）。"""

    __tablename__ = "meeting_participants"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), primary_key=True)


class MeetingProposal(Base):
    """各参加者が会議で出した提案。"""

    __tablename__ = "meeting_proposals"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    content: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MeetingReport(Base):
    """リーダーが全提案を集約したレポート。1会議につき1件。"""

    __tablename__ = "meeting_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), unique=True)
    content: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
