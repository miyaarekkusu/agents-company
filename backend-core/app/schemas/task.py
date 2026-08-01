"""役割: お題（`tasks`）関連APIのリクエスト/レスポンスの型（Pydanticスキーマ）を定義する。

`app/models/task.py`の`Task`（DBモデル）とは別物。こちらはAPIの入出力用の型。
"""
from datetime import datetime

from pydantic import BaseModel


class TaskOut(BaseModel):
    """お題1件分の情報。会議中・作業中の場合は`in_progress_agent_names`に担当者名が入る。"""

    id: int
    title: str
    description: str
    status: str
    requires_meeting: bool
    created_at: datetime
    in_progress_agent_names: list[str]


class CreateTaskRequest(BaseModel):
    """社長がお題を新規作成する際に送るリクエストボディ。"""

    task_text: str
    requires_meeting: bool


class UpdateTaskRequest(BaseModel):
    """お題の部分更新リクエストボディ（未指定の項目は変更しない）。"""

    task_text: str | None = None
    requires_meeting: bool | None = None
