"""役割: 雇用画面のカタログ（役職・AIモデル・スキル）とエージェント関連のAPIルーター。

管理ロジックそのものはここには書かず、`app/services/hiring.py`/`app/services/availability.py`に
置き、ここでは「サービス層を呼んでレスポンス用スキーマに変換する」ことだけを行う。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.agent import AgentSkill
from app.models.ai_model import AIModel
from app.models.role import Role
from app.models.skill import Skill
from app.schemas.agent import (
    AgentOut,
    AIModelOut,
    HireAgentRequest,
    RoleOut,
    SkillOut,
    UpdateAgentRequest,
)
from app.services import availability, hiring
from app.services.hiring import AgentDetail

router = APIRouter()


def _role_out(role: Role) -> RoleOut:
    return RoleOut(
        id=role.id, name=role.name, requires_design_capable_model=role.requires_design_capable_model
    )


def _ai_model_out(ai_model: AIModel) -> AIModelOut:
    return AIModelOut(
        id=ai_model.id,
        provider=ai_model.provider,
        model_name=ai_model.model_name,
        display_name=ai_model.display_name,
        description=ai_model.description,
        capability_tags=list(ai_model.capability_tags),
    )


def _skill_out(skill: Skill) -> SkillOut:
    return SkillOut(id=skill.id, name=skill.name, description=skill.description)


async def _skills_by_agent_ids(session: AsyncSession, agent_ids: list[int]) -> dict[int, list[Skill]]:
    """agent_idごとの`Skill`一覧（id・descriptionを含むフルオブジェクト）をまとめて取得する。

    `app/services/hiring.py`の`_skill_names_by_agent`はスキル名のみを返すため、
    `AgentOut.skills`に必要なid/descriptionを得るためにここで別途引く。
    """
    if not agent_ids:
        return {}
    rows = await session.execute(
        select(AgentSkill.agent_id, Skill)
        .join(Skill, Skill.id == AgentSkill.skill_id)
        .where(AgentSkill.agent_id.in_(agent_ids))
    )
    result: dict[int, list[Skill]] = {}
    for agent_id, skill in rows.all():
        result.setdefault(agent_id, []).append(skill)
    return result


def _agent_out(detail: AgentDetail, skills: list[Skill]) -> AgentOut:
    return AgentOut(
        id=detail.agent.id,
        name=detail.agent.name,
        personality=detail.agent.personality,
        role=_role_out(detail.agent.role),
        ai_model=_ai_model_out(detail.agent.ai_model),
        skills=[_skill_out(s) for s in skills],
        hired_at=detail.agent.hired_at,
    )


@router.get("/roles", response_model=list[RoleOut])
async def get_roles(session: AsyncSession = Depends(get_db)) -> list[RoleOut]:
    """役職一覧を返す（雇用画面の役職選択肢）。"""
    roles = await hiring.list_roles(session)
    return [_role_out(role) for role in roles]


@router.get("/ai-models", response_model=list[AIModelOut])
async def get_ai_models(
    role_id: int = Query(...), session: AsyncSession = Depends(get_db)
) -> list[AIModelOut]:
    """指定した役職で選択可能なAIモデル一覧を返す（雇用画面のAIモデル選択肢）。"""
    role = await session.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail=f"未登録のrole_idです: {role_id}")
    models = await hiring.list_available_ai_models(session, role)
    return [_ai_model_out(m) for m in models]


@router.get("/skills", response_model=list[SkillOut])
async def get_skills(session: AsyncSession = Depends(get_db)) -> list[SkillOut]:
    """スキル一覧を返す（雇用画面のスキル選択肢）。"""
    skills = await hiring.list_skills(session)
    return [_skill_out(s) for s in skills]


@router.get("/agents", response_model=list[AgentOut])
async def get_agents(session: AsyncSession = Depends(get_db)) -> list[AgentOut]:
    """登録済みエージェントの一覧を、役職・AIモデル・スキルを含めて返す。"""
    details = await hiring.list_agent_details(session)
    skills_by_agent = await _skills_by_agent_ids(session, [d.agent.id for d in details])
    return [_agent_out(d, skills_by_agent.get(d.agent.id, [])) for d in details]


@router.get("/agents/busy", response_model=list[int])
async def get_busy_agents(session: AsyncSession = Depends(get_db)) -> list[int]:
    """現在、会議中・作業中（busy）のエージェントIDの一覧を返す。"""
    busy_ids = await availability.list_busy_agent_ids(session)
    return list(busy_ids)


@router.post("/agents", response_model=AgentOut)
async def create_agent(
    request: HireAgentRequest, session: AsyncSession = Depends(get_db)
) -> AgentOut:
    """新しいエージェントを雇用する。`system_prompt`はサーバー側で組み立てる。"""
    role = await session.get(Role, request.role_id)
    if role is None:
        raise HTTPException(status_code=404, detail=f"未登録のrole_idです: {request.role_id}")
    ai_model = await session.get(AIModel, request.ai_model_id)
    if ai_model is None:
        raise HTTPException(status_code=404, detail=f"未登録のai_model_idです: {request.ai_model_id}")

    system_prompt = hiring.build_system_prompt(request.name, request.personality, role.name, ai_model.provider)
    agent = await hiring.create_agent(
        session,
        name=request.name,
        personality=request.personality,
        role_id=request.role_id,
        ai_model_id=request.ai_model_id,
        system_prompt=system_prompt,
        skill_ids=request.skill_ids,
    )

    detail = await hiring.get_agent_detail(session, agent.id)
    skills = await _skills_by_agent_ids(session, [agent.id])
    return _agent_out(detail, skills.get(agent.id, []))


@router.patch("/agents/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: int, request: UpdateAgentRequest, session: AsyncSession = Depends(get_db)
) -> AgentOut:
    """エージェント情報を部分更新する。名前・性格・役職のいずれかが変わる場合はsystem_promptも再構築する。"""
    detail = await hiring.get_agent_detail(session, agent_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"未登録のagent_idです: {agent_id}")

    effective_name = request.name if request.name is not None else detail.agent.name
    effective_personality = (
        request.personality if request.personality is not None else detail.agent.personality
    )
    effective_role = detail.agent.role
    if request.role_id is not None:
        new_role = await session.get(Role, request.role_id)
        if new_role is None:
            raise HTTPException(status_code=404, detail=f"未登録のrole_idです: {request.role_id}")
        effective_role = new_role
    effective_ai_model = detail.agent.ai_model
    if request.ai_model_id is not None:
        new_ai_model = await session.get(AIModel, request.ai_model_id)
        if new_ai_model is None:
            raise HTTPException(status_code=404, detail=f"未登録のai_model_idです: {request.ai_model_id}")
        effective_ai_model = new_ai_model

    system_prompt = None
    if request.name is not None or request.personality is not None or request.role_id is not None:
        system_prompt = hiring.build_system_prompt(
            effective_name, effective_personality, effective_role.name, effective_ai_model.provider
        )

    try:
        await hiring.update_agent(
            session,
            agent_id=agent_id,
            name=request.name,
            personality=request.personality,
            role_id=request.role_id,
            ai_model_id=request.ai_model_id,
            system_prompt=system_prompt,
            skill_ids=request.skill_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated_detail = await hiring.get_agent_detail(session, agent_id)
    skills = await _skills_by_agent_ids(session, [agent_id])
    return _agent_out(updated_detail, skills.get(agent_id, []))


@router.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: int, session: AsyncSession = Depends(get_db)) -> None:
    """エージェントを削除する。"""
    try:
        await hiring.delete_agent(session, agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
