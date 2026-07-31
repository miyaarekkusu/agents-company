"""役割: roles / ai_models / skills / agents への初期データ投入（seed）スクリプト。

サーバー起動不要、backend-core直下で(venvを有効化した状態で)
`python scripts/seed_db.py` を実行する（`scripts/chat.py`と同じ実行方法）。

再実行安全性: 各テーブルとも「name（等の一意キー）で既存レコードの有無を確認してから
INSERTする」方式にしているため、何度実行しても重複データは増えない。
ただしagentsのみ、既存行が見つかった場合はスキップではなくpersonality/system_promptを
最新の内容で上書き（UPDATE）する。これはagents/*.mdのペルソナ定義を後から調整した際に、
再実行するだけでDBに反映できるようにするため。

投入するデータの位置づけ:
- roles: DATABASE.md / AGENTS.mdで確定している7役職。
- ai_models: 現状実際に呼び出せるのはdeepseek-v4-proのみ（app/services/llm.py参照）。
  claude系2件はマスタ登録のみで、実際のAPI呼び出しは未実装。
- skills: 具体的なスキル一覧はまだ確定していない仮データ（後で見直される前提）。
- agents: ひらめきポン太1体。system_promptはagents/idea_agent.mdから動的に読み込む
  （persona.load_system_promptを使い、ハードコードしない）。
"""
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.agent import Agent
from app.models.ai_model import AIModel
from app.models.role import Role
from app.models.skill import Skill
from app.services.persona import load_system_prompt

ROLES: list[dict] = [
    {"name": "フロントエンド", "requires_design_capable_model": False},
    {"name": "バックエンド", "requires_design_capable_model": False},
    {"name": "フルスタック", "requires_design_capable_model": False},
    {"name": "テクリード", "requires_design_capable_model": True},
    {"name": "マネージャー", "requires_design_capable_model": False},
    {"name": "案出し担当", "requires_design_capable_model": False},
    {"name": "デザイナー", "requires_design_capable_model": False},
]

AI_MODELS: list[dict] = [
    {
        "provider": "deepseek",
        "model_name": "deepseek-v4-pro",
        "display_name": "DeepSeek V4 Pro",
        "description": "バランス型。会話・アイデア出しなど汎用タスクが得意。",
        "capability_tags": ["coding", "brainstorming"],
    },
    {
        "provider": "claude",
        "model_name": "claude-opus-4-8",
        "display_name": "Claude Opus 4.8",
        "description": "設計・判断力に優れる。上流工程やテクリード向き。",
        "capability_tags": ["design", "leadership", "coding"],
    },
    {
        "provider": "claude",
        "model_name": "claude-haiku-4-5",
        "display_name": "Claude Haiku 4.5",
        "description": "軽量・高速。定型的なコーディング向き。",
        "capability_tags": ["coding"],
    },
]

# NOTE: 具体的なスキル一覧はまだ確定していないため、ごく少数の仮データ。
# 後で見直される前提（DATABASE.md / AGENTS.mdの「skills/フォルダの実データ化」ロードマップ参照）。
SKILLS: list[dict] = [
    {"name": "アイデア発想", "description": "お題に対して複数の案を出す力"},
    {"name": "コーディング", "description": "実装力"},
    {"name": "デザイン", "description": "UI/UX設計力"},
]


async def seed_roles(session) -> dict[str, Role]:
    """roles投入。nameで存在チェックし、無ければ追加する。"""
    roles_by_name: dict[str, Role] = {}
    for data in ROLES:
        existing = await session.scalar(select(Role).where(Role.name == data["name"]))
        if existing is not None:
            roles_by_name[data["name"]] = existing
            continue
        role = Role(**data)
        session.add(role)
        roles_by_name[data["name"]] = role
    await session.flush()
    return roles_by_name


async def seed_ai_models(session) -> dict[str, AIModel]:
    """ai_models投入。model_nameで存在チェックし、無ければ追加する。"""
    models_by_name: dict[str, AIModel] = {}
    for data in AI_MODELS:
        existing = await session.scalar(
            select(AIModel).where(AIModel.model_name == data["model_name"])
        )
        if existing is not None:
            models_by_name[data["model_name"]] = existing
            continue
        model = AIModel(**data)
        session.add(model)
        models_by_name[data["model_name"]] = model
    await session.flush()
    return models_by_name


async def seed_skills(session) -> dict[str, Skill]:
    """skills投入。nameで存在チェックし、無ければ追加する。"""
    skills_by_name: dict[str, Skill] = {}
    for data in SKILLS:
        existing = await session.scalar(select(Skill).where(Skill.name == data["name"]))
        if existing is not None:
            skills_by_name[data["name"]] = existing
            continue
        skill = Skill(**data)
        session.add(skill)
        skills_by_name[data["name"]] = skill
    await session.flush()
    return skills_by_name


async def seed_agents(session, roles_by_name: dict[str, Role], models_by_name: dict[str, AIModel]) -> None:
    """agents投入（ひらめきポン太）。nameで存在チェックし、無ければ追加する。

    既存行が見つかった場合は、personality/system_promptを最新の内容でUPDATEする
    （agents/idea_agent.mdのペルソナを調整した際に、再実行するだけで反映するため）。
    """
    name = "ひらめきポン太"
    personality = (
        "発想力豊かで自由奔放、前向き。"
        "落ち着いた丁寧な話し方で、社長のお題に対して複数のアイデアを簡潔に提案する担当。"
    )
    system_prompt = load_system_prompt("idea_agent.md")

    existing = await session.scalar(select(Agent).where(Agent.name == name))
    if existing is not None:
        existing.personality = personality
        existing.system_prompt = system_prompt
        return

    agent = Agent(
        name=name,
        personality=personality,
        role_id=roles_by_name["案出し担当"].id,
        ai_model_id=models_by_name["deepseek-v4-pro"].id,
        system_prompt=system_prompt,
    )
    session.add(agent)
    await session.flush()


async def main() -> None:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            roles_by_name = await seed_roles(session)
            models_by_name = await seed_ai_models(session)
            await seed_skills(session)
            await seed_agents(session, roles_by_name, models_by_name)
        print("seed完了: roles / ai_models / skills / agents への投入処理が完了しました。")


if __name__ == "__main__":
    asyncio.run(main())
