"""役割: LangGraphによる最小オーケストレーション。社長のお題を、社長が指定したエージェントに渡すだけの一本道グラフ。

--- LangGraphの基本概念（チーム内の他エージェント/メンバー向けの補足） ---

LangGraphは「State（状態） / Node（ノード） / Edge（エッジ）」の3つでエージェントの処理フローを組み立てる。

- State: グラフ全体で受け渡されるデータ。ここでは`TaskState`（TypedDict）で定義する。
  各ノードは「今のState」を受け取り、「更新後のState」を返す。
- Node: 「Stateを受け取り、加工して、更新したStateを返す」ただの非同期関数。
  LLM呼び出しなどの実処理そのものは`app/services/llm.py`に置き、
  ノード関数はそれを呼び出して結果をStateに詰めるだけの役割にする（責務を分離する）。
- Edge: ノード同士のつながり（実行順）。`START`/`END`はLangGraphが用意する開始/終了の特殊ノード。
  条件によって次に実行するノードを分岐させたい場合（会議室での役割分担など）は、
  `add_edge`の代わりに`add_conditional_edges`を使う（今回は未使用）。
- compile(): 上記のNode/Edge定義から、実行可能なグラフオブジェクトを組み立てる。
  一度compileしてモジュールレベルの`graph`としてエクスポートし、呼び出し側（`app/api/tasks.py`）は
  `await graph.ainvoke(初期State)`で実行するだけでよい。

今回は「社長のお題と依頼先の`agent_id`を受け取る → `agent_id`に対応するエージェントのペルソナで
LLMを呼ぶ → 結果を返す」という`START → run_agent → END`の一本道グラフのみを実装している。
どのエージェントを使うかは固定ではなく、リクエストごとにStateの`agent_id`を見て
`app/services/agents_registry.py`から該当エージェントの情報を引き、
`app/services/persona.py`でそのペルソナのシステムプロンプトを読み込む。
会議室での複数エージェント分岐や、状態のDB永続化（checkpointer）は次のイテレーションで拡張する
（AGENTS.md参照）。
"""
from functools import lru_cache
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.agents_registry import get_agent
from app.services.llm import call_deepseek
from app.services.persona import load_system_prompt


class TaskState(TypedDict):
    """グラフ内で受け渡す状態。ノードを増やす場合はここにフィールドを追加していく。"""

    task: str
    """社長から出されたお題（入力）。"""
    agent_id: str
    """社長がどのエージェントに依頼するかを表すID（`app/services/agents_registry.py`参照）。"""
    result: str
    """エージェントの回答（出力）。"""


@lru_cache(maxsize=None)
def _load_system_prompt_cached(persona_file: str) -> str:
    """agent_idごとのシステムプロンプトをキャッシュする。

    同じエージェントへの問い合わせで毎回`agents/*.md`を読み直さずに済むよう、
    ペルソナファイル名をキーにキャッシュする（シンプルさ優先の軽量な最適化）。
    """
    return load_system_prompt(persona_file)


async def run_agent_node(state: TaskState) -> TaskState:
    """唯一のノード。`state["agent_id"]`に対応するエージェントとしてLLMを呼ぶ。

    `agent_id`が未登録の場合は`app/api/tasks.py`側でグラフ呼び出し前に弾く想定のため、
    ここでは登録済みのエージェントが渡ってくる前提でよい（念のためValueErrorで防御する）。
    LLM呼び出しの実処理は`llm.py`に委譲し、ここでは`agents/`配下のMarkdown由来の
    システムプロンプトを渡した上で結果をStateに詰めるだけ。
    """
    agent = get_agent(state["agent_id"])
    if agent is None:
        raise ValueError(f"未登録のagent_idです: {state['agent_id']}")

    system_prompt = _load_system_prompt_cached(agent.persona_file)
    result = await call_deepseek(state["task"], system_prompt=system_prompt)
    return {"task": state["task"], "agent_id": state["agent_id"], "result": result}


def _build_graph():
    """Node/Edgeを登録してグラフを組み立て、compileする。

    ノードを追加する場合は`builder.add_node("名前", 関数)`を足し、
    実行順は`builder.add_edge("Aの名前", "Bの名前")`でつなぐ。
    """
    builder = StateGraph(TaskState)
    builder.add_node("run_agent", run_agent_node)
    builder.add_edge(START, "run_agent")  # START(開始) → run_agentノード
    builder.add_edge("run_agent", END)  # run_agentノード → END(終了)
    return builder.compile()


# アプリ起動時に一度だけ組み立てる、実行可能なグラフ本体。
# `app/api/tasks.py`から`await graph.ainvoke({...})`の形で呼び出す。
graph = _build_graph()
