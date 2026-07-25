"""役割: 登録済みエージェントの一覧を管理するレジストリ。

エージェントが1体しかいない現段階ではDBを使わず、Pythonの静的な辞書で管理する。
エージェントが増えてDB設計を行う際は、ここを読み替える形でDBテーブルに移行する想定。
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class AgentInfo:
    """登録済みエージェント1体分の情報。"""

    agent_id: str
    """エージェントを一意に識別するID（API上でもこの値を使う）。"""
    name: str
    """キャラクター名（社長がエージェントを選ぶ際に表示する名前）。"""
    persona_file: str
    """`agents/`配下の、このエージェントのペルソナ定義ファイル名。"""


AGENT_REGISTRY: dict[str, AgentInfo] = {
    "idea_agent": AgentInfo(
        agent_id="idea_agent",
        name="ひらめきポン太",
        persona_file="idea_agent.md",
    ),
}


def get_agent(agent_id: str) -> AgentInfo | None:
    """agent_idからAgentInfoを取得する。未登録のIDの場合はNoneを返す。"""
    return AGENT_REGISTRY.get(agent_id)


def list_agents() -> list[AgentInfo]:
    """登録済みエージェントの一覧を返す。"""
    return list(AGENT_REGISTRY.values())
