"""役割: `GET /api/agents`のレスポンスの型（Pydanticスキーマ）を定義する。

`app/services/agents_registry.py`の`AgentInfo`（レジストリ内部の型）とは別物。こちらはAPIの
出力用の型で、`persona_file`のような内部実装の詳細はフロントエンドに公開しない。
"""
from pydantic import BaseModel


class AgentSummary(BaseModel):
    """社長がエージェントを選ぶ際に表示する、登録済みエージェント1体分の情報。"""

    agent_id: str
    name: str
