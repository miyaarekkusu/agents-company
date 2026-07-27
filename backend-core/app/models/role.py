"""役割: `roles`テーブル（エージェントの役職マスタ）のORMモデル。詳細は`DATABASE.md`参照。"""
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    """フロントエンド/バックエンド/フルスタック/テクリード/マネージャー/案出し担当/デザイナー等"""
    requires_design_capable_model: Mapped[bool] = mapped_column(Boolean, default=False)
    """trueの場合、この役職に就くエージェントのAIモデル選択をハード制限する"""
