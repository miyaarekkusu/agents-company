"""ターミナルから直接LangGraphのグラフと対話して動作確認するための簡易CLI。

サーバー起動やcurlは不要。backend-core直下で(venvを有効化した状態で)
`python scripts/chat.py` を実行する。

起動時に登録済みエージェント一覧を表示し、社長役のユーザーがどのエージェントに
依頼するかを選んでから、お題を聞くループに入る。
"""
import asyncio
import sys

from app.services.agents_registry import list_agents
from app.services.graph import graph

# Windows環境で標準入出力がUTF-8以外になる場合があるため明示的に指定する。
sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")


def choose_agent() -> str:
    """登録済みエージェント一覧を表示し、ユーザーに選ばせてagent_idを返す。

    番号入力・agent_id直接入力のどちらでも選べるようにする。
    エージェントが1体しか登録されていない現状でも、今後複数登録された際に
    そのまま使える作りにしている。
    """
    agents = list_agents()
    print("依頼先のエージェントを選んでください。")
    for i, agent in enumerate(agents, start=1):
        print(f"  {i}. {agent.name}（agent_id: {agent.agent_id}）")

    agent_by_id = {agent.agent_id: agent for agent in agents}
    while True:
        choice = input("番号またはagent_idを入力してください> ").strip()
        if choice in agent_by_id:
            return agent_by_id[choice].agent_id
        if choice.isdigit() and 1 <= int(choice) <= len(agents):
            return agents[int(choice) - 1].agent_id
        print("入力が正しくありません。もう一度入力してください。")


async def main() -> None:
    agent_id = choose_agent()
    print("お題を入力してください。何も入力せずEnterで終了します。")
    while True:
        task = input("お題> ").strip()
        if not task:
            break
        state = await graph.ainvoke({"task": task, "result": "", "agent_id": agent_id})
        print(f"結果> {state['result']}\n")


if __name__ == "__main__":
    asyncio.run(main())
