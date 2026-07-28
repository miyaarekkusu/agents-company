"""役割: `tasks`テーブル（社長が出したお題）のORMモデル。詳細は`DATABASE.md`参照。

`status`は固定の状態遷移で管理する（`awaiting_meeting` → `meeting_in_progress` →
`awaiting_approval` → `ready_for_work` → `work_in_progress` → `completed`。
`requires_meeting=False`の場合は`awaiting_meeting`/`meeting_in_progress`/`awaiting_approval`を
経由せず`ready_for_work`から始まる）。`meeting_in_progress`/`work_in_progress`の間は、
会議・作業がバックグラウンドで進行中であることを表す（`app/services/meetings.py`の
`start_meeting`/`finish_meeting`、`app/services/work.py`の`start_work`/`finish_work`参照）。
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String(50), default="open")
    requires_meeting: Mapped[bool] = mapped_column(Boolean, default=False)
    """会議室での話し合いが必要かどうか（お題作成時に社長が選択する）。"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
