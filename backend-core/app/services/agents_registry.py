"""役割: 登録済みエージェントの一覧を管理するレジストリ。

DB化にともない、`agents`テーブル（`app/models/agent.py`の`Agent`モデル）を参照する形に切り替えた。
呼び出し側は`Agent`モデル自体（`.id`, `.name`, `.system_prompt`等）を直接使う。
"""
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent


async def get_agent(session: AsyncSession, agent_id: int) -> Agent | None:
    """agent_idからAgentを取得する。未登録のIDの場合はNoneを返す。"""
    return await session.get(Agent, agent_id)


async def list_agents(session: AsyncSession) -> Sequence[Agent]:
    """登録済みエージェントの一覧を返す。"""
    result = await session.scalars(select(Agent))
    return result.all()
