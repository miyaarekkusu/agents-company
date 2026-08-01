"""役割: メール（`email_threads`/`email_messages`）関連APIのレスポンスの型（Pydanticスキーマ）を定義する。"""
from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    """通知（メールスレッド）1件分の情報（本文付き）。"""

    id: int
    task_id: int
    agent_id: int
    subject: str
    status: str
    body: str
    created_at: datetime
