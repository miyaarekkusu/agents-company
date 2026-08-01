"""役割: 作業室関連のAPIルーター。HTTPの入出力(Pydanticスキーマ)と`app/services/work.py`をつなぐ薄い層。

作業は「予約（`start_work`）→ バックグラウンド実行（`finish_work`）」の2段階になっている。
LLM呼び出しに時間がかかるため、`finish_work`はHTTPレスポンスをブロックせず
`app/core/background.py`の`track_background`でバックグラウンド起動し、`await`しない。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.background import track_background
from app.core.database import get_db
from app.schemas.work import ArtifactOut, StartWorkRequest, WorkSessionDetailOut, WorkSessionOut
from app.services import work as work_service

router = APIRouter()


@router.get("/work/status")
async def get_work_status(session: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    """作業室が使用中（進行中の作業がある）かどうかを返す（情報表示用、同時進行数の制限はない）。"""
    busy = await work_service.has_in_progress_work(session)
    return {"busy": busy}


@router.get("/tasks/{task_id}/work-session", response_model=WorkSessionDetailOut)
async def get_task_work_session(
    task_id: int, session: AsyncSession = Depends(get_db)
) -> WorkSessionDetailOut:
    """指定したお題の最新の作業セッション（リーダー・担当者・開始時刻）を返す。
    作業室の「リアルタイムで見る」モーダルが、作業の進み具合をポーリングして表示するために使う。
    """
    detail = await work_service.get_latest_work_session_for_task(session, task_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="このお題の作業セッションが見つかりません。")
    return WorkSessionDetailOut(
        id=detail.work_session.id,
        task_id=detail.work_session.task_id,
        leader_agent_id=detail.work_session.leader_agent_id,
        worker_agent_ids=detail.worker_agent_ids,
        status=detail.work_session.status,
        created_at=detail.work_session.created_at,
    )


@router.post("/work-sessions", response_model=WorkSessionOut)
async def start_work(
    request: StartWorkRequest, session: AsyncSession = Depends(get_db)
) -> WorkSessionOut:
    """作業を予約し、バックグラウンドで実行を開始する。"""
    try:
        work_session = await work_service.start_work(
            session,
            task_id=request.task_id,
            worker_agent_ids=request.worker_agent_ids,
            leader_agent_id=request.leader_agent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    track_background(work_service.finish_work(work_session.id))

    return WorkSessionOut(
        id=work_session.id,
        task_id=work_session.task_id,
        leader_agent_id=work_session.leader_agent_id,
        status=work_session.status,
        created_at=work_session.created_at,
    )


@router.get("/artifacts", response_model=list[ArtifactOut])
async def get_artifacts(session: AsyncSession = Depends(get_db)) -> list[ArtifactOut]:
    """成果物一覧を返す（表示用にお題名・エージェント名を含む）。"""
    views = await work_service.list_artifacts(session)
    return [
        ArtifactOut(
            id=v.artifact.id,
            task_id=v.artifact.task_id,
            task_title=v.task_title,
            type=v.artifact.type,
            content=v.artifact.content,
            created_by_agent_id=v.artifact.created_by_agent_id,
            agent_name=v.agent_name,
            created_at=v.artifact.created_at,
        )
        for v in views
    ]
