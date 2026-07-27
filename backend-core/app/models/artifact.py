"""役割: `artifacts`テーブル（作業結果・成果物）のORMモデル。

最初はWebサイト・レポート・企画案の3種類（`type`）に絞る。Webサイト種別は、生成したコードを
`content`にそのまま保存し、フロント側で簡易プレビュー表示する第一段階とする（詳細は`DATABASE.md`参照）。
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    type: Mapped[str] = mapped_column(String(20))
    """website / report / proposal のいずれか"""
    content: Mapped[str] = mapped_column(String)
    """コード本体やレポート本文をそのまま保存"""
    created_by_agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
