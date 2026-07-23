from fastapi import APIRouter

from app.schemas.task import TaskRequest, TaskResult
from app.services.graph import graph

router = APIRouter()


@router.post("/tasks", response_model=TaskResult)
async def create_task(request: TaskRequest) -> TaskResult:
    state = await graph.ainvoke({"task": request.task, "result": ""})
    return TaskResult(result=state["result"])
