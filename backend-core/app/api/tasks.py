"""役割: お題（`tasks`）関連のAPIルーター。HTTPの入出力(Pydanticスキーマ)と`app/services/work.py`をつなぐ薄い層。

お題の状態遷移ロジックそのものはここには書かず、`app/services/work.py`に置き、ここでは
「サービス層を呼んでレスポンス用スキーマに変換する」ことだけを行う。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.task import Task
from app.schemas.task import CreateTaskRequest, TaskOut, UpdateTaskRequest
from app.services import availability, work

router = APIRouter()

_IN_PROGRESS_STATUSES = ("meeting_in_progress", "work_in_progress")


async def _task_out(session: AsyncSession, task: Task, *, lookup_in_progress: bool = True) -> TaskOut:
    """`Task`をレスポンス用スキーマに変換する。

    会議中・作業中のお題は、`app/services/availability.py`から担当エージェント名を引いて添える
    （`scripts/game_cli.py`の`view_tasks_flow`と同じ挙動）。
    """
    in_progress_agent_names: list[str] = []
    if lookup_in_progress and task.status in _IN_PROGRESS_STATUSES:
        in_progress_agent_names = await availability.get_in_progress_agent_names(session, task.id)
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        requires_meeting=task.requires_meeting,
        created_at=task.created_at,
        in_progress_agent_names=in_progress_agent_names,
    )


@router.get("/tasks", response_model=list[TaskOut])
async def get_tasks(session: AsyncSession = Depends(get_db)) -> list[TaskOut]:
    """登録済みのお題一覧を返す。"""
    tasks = await work.list_tasks(session)
    return [await _task_out(session, t) for t in tasks]


@router.get("/tasks/awaiting-meeting", response_model=list[TaskOut])
async def get_tasks_awaiting_meeting(session: AsyncSession = Depends(get_db)) -> list[TaskOut]:
    """会議室での話し合いがまだのお題一覧を返す。"""
    tasks = await work.list_awaiting_meeting_tasks(session)
    return [await _task_out(session, t, lookup_in_progress=False) for t in tasks]


@router.get("/tasks/ready-for-work", response_model=list[TaskOut])
async def get_tasks_ready_for_work(session: AsyncSession = Depends(get_db)) -> list[TaskOut]:
    """作業を割り当てられる状態のお題一覧を返す。"""
    tasks = await work.list_ready_for_work_tasks(session)
    return [await _task_out(session, t, lookup_in_progress=False) for t in tasks]


@router.post("/tasks", response_model=TaskOut)
async def create_task(request: CreateTaskRequest, session: AsyncSession = Depends(get_db)) -> TaskOut:
    """社長が新しいお題を登録する。"""
    task = await work.create_task(session, task_text=request.task_text, requires_meeting=request.requires_meeting)
    return await _task_out(session, task)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int, request: UpdateTaskRequest, session: AsyncSession = Depends(get_db)
) -> TaskOut:
    """お題の内容・会議要否を部分更新する。"""
    try:
        task = await work.update_task(
            session, task_id=task_id, task_text=request.task_text, requires_meeting=request.requires_meeting
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await _task_out(session, task)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int, session: AsyncSession = Depends(get_db)) -> None:
    """お題を削除する。"""
    try:
        await work.delete_task(session, task_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
