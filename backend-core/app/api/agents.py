"""役割: エージェント関連のAPIルーター。登録済みエージェントの一覧をHTTPで返すだけの薄い層。

エージェントの管理ロジックそのものはここには書かず、`app/services/agents_registry.py`に置き、
ここでは「レジストリから一覧を取得してレスポンス用スキーマに変換する」ことだけを行う。
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.agent import AgentSummary
from app.services import agents_registry

router = APIRouter()


@router.get("/agents", response_model=list[AgentSummary])
async def get_agents(session: AsyncSession = Depends(get_db)) -> list[AgentSummary]:
    """登録済みエージェントの一覧を返す。

    社長がお題を出す際に「どのエージェントに依頼するか」を選べるように、
    フロントエンドが選択肢として表示するための情報（agent_id・name）のみを返す。
    """
    agents = await agents_registry.list_agents(session)
    return [AgentSummary(agent_id=agent.id, name=agent.name) for agent in agents]
