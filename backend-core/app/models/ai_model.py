"""役割: `ai_models`テーブル（エージェントに割り当て可能なAIモデルのマスタ）のORMモデル。

`capability_tags`は、`roles.requires_design_capable_model`が`true`の役職で
選択可能なモデルを絞り込む（ハード制限する）ために使う。詳細は`DATABASE.md`参照。
"""
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AIModel(Base):
    __tablename__ = "ai_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(50))
    """claude / openai / deepseek / gemini"""
    model_name: Mapped[str] = mapped_column(String(100))
    """例: claude-opus-4-8"""
    display_name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String)
    """得意分野の説明文（エージェント作成画面に表示）"""
    capability_tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    """得意分野タグ（例: ["design", "coding"]）"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
