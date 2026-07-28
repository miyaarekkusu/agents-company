"""役割: `work_sessions`/`work_session_participants`テーブルのORMモデル。

作業室での「作業割り当て」を表す。`Meeting`/`MeetingParticipant`と同じ構成で、
バックグラウンドで進行中の作業とその担当者（worker・リーダー）を予約・追跡するために使う
（`app/services/work.py`の`start_work`/`finish_work`参照）。
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WorkSession(Base):
    __tablename__ = "work_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    leader_agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    status: Mapped[str] = mapped_column(String(50), default="in_progress")
    """in_progress / completed / failed"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkSessionParticipant(Base):
    """`work_sessions`と`agents`の多対多中間テーブル（作業の担当者。リーダーも含む）。"""

    __tablename__ = "work_session_participants"

    work_session_id: Mapped[int] = mapped_column(ForeignKey("work_sessions.id"), primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), primary_key=True)
