"""役割: 会議室（`meetings`/`meeting_reports`）関連APIのリクエスト/レスポンスの型（Pydanticスキーマ）を定義する。"""
from datetime import datetime

from pydantic import BaseModel


class StartMeetingRequest(BaseModel):
    """社長（または会議室）が会議を予約する際に送るリクエストボディ。"""

    task_id: int
    leader_agent_id: int
    participant_agent_ids: list[int]


class MeetingOut(BaseModel):
    """予約された会議1件分の情報。"""

    id: int
    task_id: int
    leader_agent_id: int
    status: str
    created_at: datetime


class MeetingStatusOut(BaseModel):
    """会議室の使用状況。busy=Trueの場合、進行中の会議のリーダー・参加者IDも含める
    （フロントエンドの会議室画面で「会議に参加しているエージェントだけ」を表示するために使う）。
    """

    busy: bool
    leader_agent_id: int | None = None
    participant_agent_ids: list[int] = []


class PendingReportOut(BaseModel):
    """社長の承認待ちの会議レポート1件分の情報。"""

    task_id: int
    task_title: str
    meeting_id: int
    report_content: str
    created_at: datetime
