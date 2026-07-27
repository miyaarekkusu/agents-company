"""役割: `POST /api/tasks`のリクエスト/レスポンスの型（Pydanticスキーマ）を定義する。

LangGraphの`TaskState`（`app/services/graph.py`）とは別物。こちらはAPIの入出力用の型で、
`TaskState`はグラフ内部で受け渡す状態の型。両者のフィールドが似ていても役割は分離しておく。
"""
from pydantic import BaseModel


class TaskRequest(BaseModel):
    """社長がAPI経由で送る「お題」。"""

    task: str
    agent_id: int
    """どのエージェントに依頼するか（`agents.id`。`app/services/agents_registry.py`経由でDB参照する）。"""


class TaskResult(BaseModel):
    """エージェント（LangGraphの実行結果）からの回答。"""

    result: str
