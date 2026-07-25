"""役割: エージェント関連のAPIルーター。登録済みエージェントの一覧をHTTPで返すだけの薄い層。

エージェントの管理ロジックそのものはここには書かず、`app/services/agents_registry.py`に置き、
ここでは「レジストリから一覧を取得してレスポンス用スキーマに変換する」ことだけを行う。
"""
from fastapi import APIRouter

from app.schemas.agent import AgentSummary
from app.services.agents_registry import list_agents

router = APIRouter()


@router.get("/agents", response_model=list[AgentSummary])
async def get_agents() -> list[AgentSummary]:
    """登録済みエージェントの一覧を返す。

    社長がお題を出す際に「どのエージェントに依頼するか」を選べるように、
    フロントエンドが選択肢として表示するための情報（agent_id・name）のみを返す。
    """
    return [
        AgentSummary(agent_id=agent.agent_id, name=agent.name)
        for agent in list_agents()
    ]
