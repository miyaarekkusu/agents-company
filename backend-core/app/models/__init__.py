"""役割: SQLAlchemyモデルの集約。ここでimportすることで`Base.metadata`に全テーブルが登録され、
Alembicのautogenerateがテーブルを検知できるようになる（`DATABASE.md`のER図に対応）。
"""
from app.models.agent import Agent, AgentSkill
from app.models.ai_model import AIModel
from app.models.artifact import Artifact
from app.models.email import EmailMessage, EmailThread
from app.models.meeting import Meeting, MeetingParticipant, MeetingProposal, MeetingReport
from app.models.role import Role
from app.models.skill import Skill
from app.models.task import Task

__all__ = [
    "Agent",
    "AgentSkill",
    "AIModel",
    "Artifact",
    "EmailMessage",
    "EmailThread",
    "Meeting",
    "MeetingParticipant",
    "MeetingProposal",
    "MeetingReport",
    "Role",
    "Skill",
    "Task",
]
