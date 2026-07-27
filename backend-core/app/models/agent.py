"""役割: `agents`テーブル（雇用したスタッフ本体）と`agent_skills`（スキルとの多対多）のORMモデル。

`system_prompt`は、これまで`agents/*.md`（`app/services/persona.py`で読み込み）で管理していた
ペルソナ定義の実体をDBに持たせたもの。詳細は`DATABASE.md`参照。
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.ai_model import AIModel
from app.models.role import Role


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    personality: Mapped[str] = mapped_column(String)
    """性格・口調"""
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    ai_model_id: Mapped[int] = mapped_column(ForeignKey("ai_models.id"))
    system_prompt: Mapped[str] = mapped_column(String)
    """LLMに渡すsystemメッセージ本文"""
    hired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    role: Mapped[Role] = relationship()
    ai_model: Mapped[AIModel] = relationship()


class AgentSkill(Base):
    """`agents`と`skills`の多対多中間テーブル。"""

    __tablename__ = "agent_skills"

    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), primary_key=True)
