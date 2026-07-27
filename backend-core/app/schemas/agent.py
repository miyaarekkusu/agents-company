"""役割: `GET /api/agents`のレスポンスの型（Pydanticスキーマ）を定義する。

`app/models/agent.py`の`Agent`（DBモデル）とは別物。こちらはAPIの出力用の型で、
`personality`や`system_prompt`のような内部実装の詳細はフロントエンドに公開しない。
"""
from pydantic import BaseModel


class AgentSummary(BaseModel):
    """社長がエージェントを選ぶ際に表示する、登録済みエージェント1体分の情報。"""

    agent_id: int
    """`agents.id`（DB上の主キー）。"""
    name: str
