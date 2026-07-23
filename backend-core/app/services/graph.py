"""LangGraphによる最小オーケストレーション。社長のお題を1エージェントに渡すだけの一本道グラフ。"""
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.llm import call_deepseek


class TaskState(TypedDict):
    task: str
    result: str


async def agent_node(state: TaskState) -> TaskState:
    result = await call_deepseek(state["task"])
    return {"task": state["task"], "result": result}


def _build_graph():
    builder = StateGraph(TaskState)
    builder.add_node("agent", agent_node)
    builder.add_edge(START, "agent")
    builder.add_edge("agent", END)
    return builder.compile()


graph = _build_graph()
