"""役割: エージェント・雇用画面関連APIのリクエスト/レスポンスの型（Pydanticスキーマ）を定義する。

`app/models/`配下のDBモデルとは別物。こちらはAPIの入出力用の型で、`system_prompt`のような
内部実装の詳細はフロントエンドに公開しない。
"""
from datetime import datetime

from pydantic import BaseModel


class RoleOut(BaseModel):
    """役職（`roles`）1件分の情報。雇用画面の役職選択肢として使う。"""

    id: int
    name: str
    requires_design_capable_model: bool


class AIModelOut(BaseModel):
    """AIモデル（`ai_models`）1件分の情報。雇用画面のAIモデル選択肢として使う。"""

    id: int
    provider: str
    model_name: str
    display_name: str
    description: str
    capability_tags: list[str]


class SkillOut(BaseModel):
    """スキル（`skills`）1件分の情報。雇用画面のスキル選択肢として使う。"""

    id: int
    name: str
    description: str


class AgentOut(BaseModel):
    """登録済みエージェント1体分の情報（役職・AIモデル・スキルを含む）。"""

    id: int
    name: str
    personality: str
    role: RoleOut
    ai_model: AIModelOut
    skills: list[SkillOut]
    hired_at: datetime


class HireAgentRequest(BaseModel):
    """社長がエージェントを雇用する際に送るリクエストボディ。"""

    name: str
    personality: str
    role_id: int
    ai_model_id: int
    skill_ids: list[int]


class UpdateAgentRequest(BaseModel):
    """エージェント情報の部分更新リクエストボディ（未指定の項目は変更しない）。"""

    name: str | None = None
    personality: str | None = None
    role_id: int | None = None
    ai_model_id: int | None = None
    skill_ids: list[int] | None = None
