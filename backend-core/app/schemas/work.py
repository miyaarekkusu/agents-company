"""役割: 作業室（`work_sessions`/`artifacts`）関連APIのリクエスト/レスポンスの型（Pydanticスキーマ）を定義する。"""
from datetime import datetime

from pydantic import BaseModel


class StartWorkRequest(BaseModel):
    """社長が作業を割り当てる際に送るリクエストボディ。"""

    task_id: int
    worker_agent_ids: list[int]
    leader_agent_id: int


class WorkSessionOut(BaseModel):
    """予約された作業1件分の情報。"""

    id: int
    task_id: int
    leader_agent_id: int
    status: str
    created_at: datetime


class WorkSessionDetailOut(BaseModel):
    """指定したお題の最新の作業セッション詳細（リーダー・担当者・開始時刻を含む）。
    作業室の「リアルタイムで見る」モーダル用。
    """

    id: int
    task_id: int
    leader_agent_id: int
    worker_agent_ids: list[int]
    status: str
    created_at: datetime


class ArtifactOut(BaseModel):
    """成果物1件分の情報（表示用にお題名・エージェント名を含む）。"""

    id: int
    task_id: int
    task_title: str | None
    type: str
    content: str
    created_by_agent_id: int
    agent_name: str | None
    created_at: datetime
