"""役割: 作業室（複数エージェントによる協力作業）のLangGraphフロー。

`app/services/meeting_graph.py`と同じ書き方に合わせる。このモジュールは純粋にLLM呼び出し
ロジックのみを担当し、DBへの保存は一切行わない（DB永続化・状態遷移のチェック等の
オーケストレーションは`app/services/work.py`側の責務。責務を分離している）。

1つのお題につき成果物は1件だけ、という方針（`DATABASE.md`/`AGENTS.md`参照）に基づき、
複数のworker（担当者）がそれぞれ自分の担当パートを作成し、リーダーがそれらを1つの
完成した成果物として統合する、という`START → run_work_node → END`の一本道グラフとして
実装する。会議レポートがあれば（`requires_meeting=True`のお題）、その内容も踏まえて作業する。
"""
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.models.agent import Agent
from app.services.llm import call_llm


class WorkState(TypedDict):
    """グラフ内で受け渡す状態。"""

    task: str
    """お題の内容（入力）。"""
    report: str | None
    """会議室で作成されたレポートの内容。会議不要のお題の場合はNone（入力）。"""
    workers: list[Agent]
    """作業の担当者一覧。それぞれが自分の担当パートを作成する（`ai_model`をロード済みのAgentである前提）。"""
    leader: Agent
    """作業のリーダー。全担当パートを1つの成果物に統合する（`ai_model`をロード済みのAgentである前提）。"""
    contributions: list[tuple[Agent, str]]
    """各workerが作成した担当パート（出力）。(担当したAgent, 内容)のタプルのリスト。"""
    final_content: str
    """リーダーが統合した最終的な成果物（出力）。"""


def _build_context(state: WorkState) -> str:
    """お題本文に、会議レポートがあればその内容を添えたコンテキスト文字列を組み立てる。"""
    if state["report"]:
        return f"{state['task']}\n\n--- 会議室での話し合いの結果（レポート） ---\n{state['report']}"
    return state["task"]


async def run_work_node(state: WorkState) -> WorkState:
    """唯一のノード。workerそれぞれに担当パートを作らせ、リーダーが1つの成果物に統合する。

    まず`_build_context`でお題（＋あれば会議レポート）をまとめ、`state["workers"]`それぞれに
    「役割分担を踏まえて自分の担当パートを作成してください」という趣旨のプロンプトで
    `call_llm`し、(Agent, 担当パート)のタプルのリストとして`contributions`に集約する。
    次に、集まった全担当パートをまとめたプロンプトを`state["leader"]`に渡し、`call_llm`で
    1つの完成した成果物として統合させ`final_content`にセットする。
    """
    context = _build_context(state)

    contributions: list[tuple[Agent, str]] = []
    for worker in state["workers"]:
        prompt = (
            f"{context}\n\n"
            "あなたは複数人で分担してこのお題に取り組むメンバーの1人です。"
            "他のメンバーとの役割分担を意識しつつ、あなたが担当するパートを作成してください。"
        )
        contribution = await call_llm(worker, prompt)
        contributions.append((worker, contribution))

    contributions_text = "\n\n".join(
        f"■ {agent.name}の担当パート:\n{content}" for agent, content in contributions
    )
    leader_prompt = (
        f"{context}\n\n"
        "以下は、各担当者が作成した担当パートです。これらを1つの完成した成果物として"
        "統合・整理してください。重複や矛盾があれば調整し、欠けている部分があれば補ってください。"
        f"\n\n{contributions_text}"
    )
    final_content = await call_llm(state["leader"], leader_prompt)

    return {
        "task": state["task"],
        "report": state["report"],
        "workers": state["workers"],
        "leader": state["leader"],
        "contributions": contributions,
        "final_content": final_content,
    }


def _build_work_graph():
    """Node/Edgeを登録してグラフを組み立て、compileする。START → run_work_node → END の一本道。"""
    builder = StateGraph(WorkState)
    builder.add_node("run_work", run_work_node)
    builder.add_edge(START, "run_work")  # START(開始) → run_workノード
    builder.add_edge("run_work", END)  # run_workノード → END(終了)
    return builder.compile()


# アプリ起動時に一度だけ組み立てる、実行可能なグラフ本体。
# `app/services/work.py`から`await work_graph.ainvoke({...})`の形で呼び出す。
work_graph = _build_work_graph()
