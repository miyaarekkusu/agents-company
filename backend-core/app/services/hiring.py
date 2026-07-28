"""役割: 「社長室」でのエージェント雇用・編集・削除ロジック。

社長がエージェントを管理する際に必要な、以下の一連の処理を扱う。
  1. 選択肢の提示（役職一覧・役職に応じて選べるAIモデル一覧・スキル一覧）
  2. 雇用の確定（`agents`行・`agent_skills`行の作成）
  3. 登録済みエージェントの参照・編集・削除

`DATABASE.md`の「上流工程寄りの役職では、選べるAIモデルをハード制限する」という決定事項に基づき、
`role.requires_design_capable_model`が`True`の場合は`ai_models.capability_tags`に`"design"`を
含むモデルのみに絞り込む（`list_available_ai_models`）。
"""
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent import Agent, AgentSkill
from app.models.ai_model import AIModel
from app.models.role import Role
from app.models.skill import Skill


async def list_roles(session: AsyncSession) -> Sequence[Role]:
    """役職一覧を返す。"""
    result = await session.scalars(select(Role))
    return result.all()


async def list_available_ai_models(session: AsyncSession, role: Role) -> Sequence[AIModel]:
    """役職に応じて選択可能なAIモデル一覧を返す。

    `role.requires_design_capable_model`が`True`の場合、`capability_tags`に`"design"`を
    含む`AIModel`のみに絞り込む（ハード制限）。`False`の場合は全モデルを返す。
    """
    stmt = select(AIModel)
    if role.requires_design_capable_model:
        stmt = stmt.where(AIModel.capability_tags.any("design"))
    result = await session.scalars(stmt)
    return result.all()


async def list_skills(session: AsyncSession) -> Sequence[Skill]:
    """スキル一覧を返す。"""
    result = await session.scalars(select(Skill))
    return result.all()


async def create_agent(
    session: AsyncSession,
    *,
    name: str,
    personality: str,
    role_id: int,
    ai_model_id: int,
    system_prompt: str,
    skill_ids: list[int],
) -> Agent:
    """Agent行とAgentSkill行をDBに作成してコミットし、作成したAgentを返す。

    `role_id`/`ai_model_id`の存在チェックはDB側の外部キー制約に委ね、ここでは行わない
    （不正なIDが渡された場合はDB側の`IntegrityError`がそのまま伝播する）。
    """
    agent = Agent(
        name=name,
        personality=personality,
        role_id=role_id,
        ai_model_id=ai_model_id,
        system_prompt=system_prompt,
    )
    session.add(agent)
    await session.flush()  # agent.idを確定させる

    for skill_id in skill_ids:
        session.add(AgentSkill(agent_id=agent.id, skill_id=skill_id))

    await session.commit()
    await session.refresh(agent)
    return agent


@dataclass
class AgentDetail:
    """社長室で登録済みエージェントを参照する際に表示する情報のまとめ。"""

    agent: Agent
    role_name: str
    ai_model_display_name: str
    skill_names: list[str]


async def _skill_names_by_agent(session: AsyncSession, agent_ids: list[int]) -> dict[int, list[str]]:
    """`agent_skills`経由でagent_idごとのスキル名一覧をまとめて取得する。

    `Agent`にはスキルへの直接のrelationshipが定義されていないため、ここで別途引く。
    """
    if not agent_ids:
        return {}
    skill_rows = await session.execute(
        select(AgentSkill.agent_id, Skill.name)
        .join(Skill, Skill.id == AgentSkill.skill_id)
        .where(AgentSkill.agent_id.in_(agent_ids))
    )
    result: dict[int, list[str]] = {}
    for agent_id, skill_name in skill_rows:
        result.setdefault(agent_id, []).append(skill_name)
    return result


async def list_agent_details(session: AsyncSession) -> Sequence[AgentDetail]:
    """登録済みエージェントを、役職名・AIモデル名・スキル名も添えて一覧で返す。

    `Agent`には`role`/`ai_model`のrelationshipがあるためeager loadで取得できるが、
    スキルは`agent_skills`経由の多対多で直接のrelationshipがないため、別途まとめて引く。
    """
    agents_result = await session.scalars(
        select(Agent).options(selectinload(Agent.role), selectinload(Agent.ai_model))
    )
    agents = agents_result.all()
    skill_names_by_agent = await _skill_names_by_agent(session, [a.id for a in agents])

    return [
        AgentDetail(
            agent=agent,
            role_name=agent.role.name,
            ai_model_display_name=agent.ai_model.display_name,
            skill_names=skill_names_by_agent.get(agent.id, []),
        )
        for agent in agents
    ]


async def get_agent_detail(session: AsyncSession, agent_id: int) -> AgentDetail | None:
    """1体分のエージェントを、役職名・AIモデル名・スキル名を添えて返す（未登録ならNone）。"""
    agent = await session.scalar(
        select(Agent)
        .where(Agent.id == agent_id)
        .options(selectinload(Agent.role), selectinload(Agent.ai_model))
    )
    if agent is None:
        return None
    skill_names_by_agent = await _skill_names_by_agent(session, [agent_id])
    return AgentDetail(
        agent=agent,
        role_name=agent.role.name,
        ai_model_display_name=agent.ai_model.display_name,
        skill_names=skill_names_by_agent.get(agent_id, []),
    )


async def update_agent(
    session: AsyncSession,
    *,
    agent_id: int,
    name: str | None = None,
    personality: str | None = None,
    role_id: int | None = None,
    ai_model_id: int | None = None,
    system_prompt: str | None = None,
    skill_ids: list[int] | None = None,
) -> Agent:
    """エージェントの情報を更新する。

    引数に`None`を渡した項目は変更しない。`skill_ids`を渡した場合は、既存の`agent_skills`を
    全て置き換える（追加・削除ではなく、指定したスキル一覧に洗い替える）。
    """
    agent = await session.get(Agent, agent_id)
    if agent is None:
        raise ValueError(f"未登録のagent_idです: {agent_id}")

    if name is not None:
        agent.name = name
    if personality is not None:
        agent.personality = personality
    if role_id is not None:
        agent.role_id = role_id
    if ai_model_id is not None:
        agent.ai_model_id = ai_model_id
    if system_prompt is not None:
        agent.system_prompt = system_prompt
    if skill_ids is not None:
        await session.execute(delete(AgentSkill).where(AgentSkill.agent_id == agent_id))
        for skill_id in skill_ids:
            session.add(AgentSkill(agent_id=agent_id, skill_id=skill_id))

    await session.commit()
    await session.refresh(agent)
    return agent


async def delete_agent(session: AsyncSession, agent_id: int) -> None:
    """エージェントを削除する（`agent_skills`の関連行も併せて削除する）。

    既に`artifacts`/`meetings`等、他のテーブルから参照されているエージェントを削除しようとすると、
    外部キー制約違反(`IntegrityError`)になる。その場合はロールバックした上で、
    CLIで案内しやすいよう`ValueError`に変換して送出する。
    """
    agent = await session.get(Agent, agent_id)
    if agent is None:
        raise ValueError(f"未登録のagent_idです: {agent_id}")

    await session.execute(delete(AgentSkill).where(AgentSkill.agent_id == agent_id))
    await session.delete(agent)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ValueError(
            "このエージェントは既にお題や会議で使われているため削除できません。"
        ) from None
