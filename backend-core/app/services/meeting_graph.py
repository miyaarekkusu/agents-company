"""役割: 会議室（複数エージェントによる話し合い）のLangGraphフロー。

`app/services/graph.py`と同じLangGraphの書き方に合わせる（State/Node/Edgeの3要素でフローを組む）。
このモジュールは純粋にLLM呼び出しロジックのみを担当し、DBへの保存は一切行わない
（DB永続化・「会議室は1つのみ」の制約チェック等のオーケストレーションは
`app/services/meetings.py`側の責務。責務を分離している）。

会議の流れは「社長が指名したリーダーと参加者を受け取る → 参加者それぞれが提案を出す →
リーダーが全提案を集約してレポートを作成する」という`START → run_meeting → END`の
一本道グラフとして実装する（DATABASE.md・AGENTS.mdの「会議室での話し合い機能」参照）。
"""
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.models.agent import Agent
from app.services.llm import call_llm


class MeetingState(TypedDict):
    """グラフ内で受け渡す状態。"""

    task: str
    """社長から出されたお題（入力）。"""
    participants: list[Agent]
    """会議の参加者一覧。それぞれが提案を出す（`ai_model`をロード済みのAgentである前提）。"""
    leader: Agent
    """社長が指名したリーダー。全提案を集約してレポートを作成する（`ai_model`をロード済みのAgentである前提）。"""
    proposals: list[tuple[Agent, str]]
    """各参加者が出した提案（出力）。(提案したAgent, 提案内容)のタプルのリスト。"""
    report: str
    """リーダーが作成した会議レポート（出力）。"""


async def run_meeting_node(state: MeetingState) -> MeetingState:
    """唯一のノード。参加者それぞれに提案を出させ、リーダーにレポートを作成させる。

    まず`state["participants"]`それぞれに対して`call_llm(agent, state["task"])`でお題を投げ、
    (Agent, 提案文字列)のタプルのリストとして`proposals`に集約する。
    次に、集まった全提案をまとめたプロンプトを`state["leader"]`に渡し、`call_llm`で
    会議レポートを生成して`report`にセットする。
    """
    proposals: list[tuple[Agent, str]] = []
    for participant in state["participants"]:
        proposal = await call_llm(participant, state["task"])
        proposals.append((participant, proposal))

    proposals_text = "\n\n".join(
        f"■ {agent.name}の提案:\n{content}" for agent, content in proposals
    )
    leader_prompt = (
        "以下は参加者から集まった提案です。内容を統合・整理して、"
        "社長への会議レポートとしてまとめてください。\n\n" + proposals_text
    )
    report = await call_llm(state["leader"], leader_prompt)

    return {
        "task": state["task"],
        "participants": state["participants"],
        "leader": state["leader"],
        "proposals": proposals,
        "report": report,
    }


def _build_meeting_graph():
    """Node/Edgeを登録してグラフを組み立て、compileする。START → run_meeting_node → END の一本道。"""
    builder = StateGraph(MeetingState)
    builder.add_node("run_meeting", run_meeting_node)
    builder.add_edge(START, "run_meeting")  # START(開始) → run_meetingノード
    builder.add_edge("run_meeting", END)  # run_meetingノード → END(終了)
    return builder.compile()


# アプリ起動時に一度だけ組み立てる、実行可能なグラフ本体。
# `app/services/meetings.py`から`await meeting_graph.ainvoke({...})`の形で呼び出す。
meeting_graph = _build_meeting_graph()
