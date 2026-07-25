"""役割: タスク関連のAPIルーター。HTTPの入出力(Pydanticスキーマ)とLangGraphのグラフ実行をつなぐだけの薄い層。

エージェントの思考ロジックそのものはここには書かない。ロジックは`app/services/graph.py`（グラフの流れ）と
`app/services/llm.py`（LLM呼び出し）に置き、ここでは「グラフを呼んで結果を返す」ことだけを行う。
"""
from fastapi import APIRouter, HTTPException

from app.schemas.task import TaskRequest, TaskResult
from app.services.agents_registry import get_agent
from app.services.graph import graph

router = APIRouter()


@router.post("/tasks", response_model=TaskResult)
async def create_task(request: TaskRequest) -> TaskResult:
    """社長のお題を、指定された`agent_id`のエージェントに渡すLangGraphのグラフに渡し、実行結果を返す。

    `request.agent_id`が未登録のエージェントIDの場合は、グラフを呼び出す前に404を返す
    （社長が存在しないエージェントIDを指定した場合の入力バリデーションなので、API層で行う）。
    `graph.ainvoke(...)`には初期状態(TaskState相当のdict)を渡す。
    グラフ内の各ノードを順に実行した後の最終状態が戻り値になる。
    """
    if get_agent(request.agent_id) is None:
        raise HTTPException(status_code=404, detail="指定されたエージェントが見つかりません")

    state = await graph.ainvoke(
        {"task": request.task, "result": "", "agent_id": request.agent_id}
    )
    return TaskResult(result=state["result"])
