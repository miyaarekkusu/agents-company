"""ターミナルでゲームの一連の流れ（雇用・お題・会議）を部屋ごとに確認するCLI。

サーバー起動やcurlは不要。backend-core直下で(venvを有効化した状態で)
`python scripts/game_cli.py` を実行する。

まずどの部屋にいるかを選び（社長室・会議室・作業室・メール）、選んだ部屋によって
できることが変わる（実際のゲーム構造に合わせた二階層メニュー）。

お題には「会議室での話し合いが必要か」を作成時に決める。必要な場合は、会議室で話し合い→
レポート作成→社長がレポートを承認する、までは作業を割り当てられない。1つのお題につき
成果物は1件だけで、複数の担当者（worker）が役割分担して協力し、リーダーが最終的な
成果物に統合する（`app/services/work.py`の状態遷移を参照）。

会議・作業は「予約 → バックグラウンド実行」の2段階になっており（`app/services/meetings.py`の
`start_meeting`/`finish_meeting`、`app/services/work.py`の`start_work`/`finish_work`）、
実行中も社長は他の部屋の操作を続けられる。完了・失敗すると「メール」にお知らせが届く
（`app/services/notifications.py`）。会議中・作業中のエージェントは、他のお題の会議・作業には
選べない（`app/services/availability.py`でbusy判定）。

- 社長室: エージェントを雇用する / お題を作成する（会議要否を決める）/ 作業を割り当てる
  （バックグラウンドで進行し、完了はメールで通知される）/ レポートを確認して承認する
- 会議室: 会議が必要なお題について、リーダー・参加者を選んでエージェント同士に話し合わせる
  （同じくバックグラウンドで進行する）
- 作業室: 完成した成果物を一覧から選んで確認する
- メール: 会議・作業の完了/失敗の通知を確認する

単体のお題投げだけを素早く試したい場合は、引き続き`scripts/chat.py`が使える。
"""
import asyncio
import sys

try:
    import msvcrt  # Windows専用。作業内容のリアルタイム監視でEnterキー検知に使う。
except ImportError:  # Windows以外では監視中のキャンセル検知は無効になる（完了時に自動終了する）
    msvcrt = None

from app.core.database import AsyncSessionLocal
from app.services import agents_registry, availability, hiring, notifications, work, work_progress
from app.services.meetings import (
    approve_report,
    finish_meeting,
    has_in_progress_meeting,
    list_reports_pending_approval,
    start_meeting,
)

# Windows環境で標準入出力がUTF-8以外になる場合があるため明示的に指定する。
sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")


def _enter_pressed() -> bool:
    """Enterキーが押されたかを非ブロッキングで確認する（作業内容のリアルタイム監視用）。

    `input()`（`_ainput`経由）は一度呼ぶとブロックし、実行中の背後のタスクが終わっても
    途中でキャンセルできない（別スレッドで動いているOSレベルの読み取りを安全に中断する
    手段が無い）。そのため監視ループの「Enterでやめる」判定には、コンソールの入力を
    直接ノンブロッキングで覗ける`msvcrt`を使う。標準入力がコンソールでない場合
    （パイプ入力等）は`OSError`になりうるため、その場合はキー検知なしとして扱う
    （完了時に自動的にループが終わるので実害はない）。
    """
    if msvcrt is None:
        return False
    try:
        pressed = False
        while msvcrt.kbhit():
            if msvcrt.getch() in (b"\r", b"\n"):
                pressed = True
        return pressed
    except OSError:
        return False


# バックグラウンドで実行中の会議・作業タスク（finish_meeting/finish_work）を保持する。
# asyncio.create_task()が返すTaskへの参照を持ち続けないとGCで消えてしまうことがあるため
# （asyncioの定石パターン）、完了時に`add_done_callback`で自動的に取り除く。
_background_tasks: set[asyncio.Task] = set()


def _track_background(coro) -> None:
    """コルーチンをバックグラウンドタスクとして起動する（呼び出し側は待たずに即座に戻る）。"""
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def _ainput(prompt: str) -> str:
    """input()を別スレッドで実行する。

    `input()`を直接呼ぶと、ユーザーの入力待ちの間イベントループ全体が止まってしまい、
    バックグラウンドで進行中の会議・作業（`_track_background`で起動したタスク）が
    一切進まなくなる。`run_in_executor`で別スレッドに逃がすことで、入力待ちの間も
    バックグラウンドタスクが進行できるようにする。
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, input, prompt)


async def _prompt_choice(prompt: str, max_value: int) -> int | None:
    """1〜max_valueの範囲の整数が入力されるまで問い合わせる。

    「0」を入力するとキャンセル扱いとして`None`を返す（誤って選択画面に入った場合に
    途中で抜けられるようにするため）。選択が確定した後は、次の画面に切り替わる前に
    少し間を置く（`asyncio.sleep(1)`）ことで、選んだ内容を目で追いやすくする。
    """
    while True:
        raw = (await _ainput(prompt)).strip()
        if raw == "0":
            return None
        if raw.isdigit() and 1 <= int(raw) <= max_value:
            await asyncio.sleep(1)
            return int(raw)
        print("番号が正しくありません（キャンセルする場合は0）。もう一度入力してください。")


_STATUS_LABELS = {
    "awaiting_meeting": "会議待ち",
    "meeting_in_progress": "会議中",
    "awaiting_approval": "レポート承認待ち",
    "ready_for_work": "作業可能",
    "work_in_progress": "作業中",
    "completed": "完了",
}

_IN_PROGRESS_STATUSES = ("meeting_in_progress", "work_in_progress")


def _status_label(status: str) -> str:
    """お題のstatusを日本語ラベルに変換する（未知の値はそのまま返す）。"""
    return _STATUS_LABELS.get(status, status)


def _build_system_prompt(name: str, personality: str, role_name: str, provider: str) -> str:
    """名前・性格・役職からシステムプロンプトを組み立てる。

    AGENTS.mdの自己認識ルール（「あなたは◯◯という名前の、〜ベースのエージェントです」）に
    従い、モデルの自己紹介がClaude等の別AIを名乗ってしまう事故を防ぐ。
    """
    base = "DeepSeekベース" if provider == "deepseek" else f"{provider}ベース"
    return (
        f"あなたは{name}という名前の、{base}のエージェントです。あなたの役職は{role_name}です。\n\n"
        f"あなたの性格・特徴は次の通りです: {personality}\n\n"
        f"社長からのお題に対して、{role_name}としての専門性を活かし、誠実かつ分かりやすく応答してください。"
        f"自己紹介を求められた場合は、自分が{name}という名前の{base}のエージェントであることを"
        f"明示的に伝えてください。"
    )


async def _choose_agent(session, prompt: str):
    """登録済みエージェント一覧を表示し、選ばれたagent_idを返す（未登録・キャンセル時はNone）。"""
    agents = await agents_registry.list_agents(session)
    if not agents:
        print("登録済みのエージェントがいません。先に社長室でエージェントを作成してください。")
        return None
    print(f"{prompt}（0でキャンセル）")
    for i, agent in enumerate(agents, start=1):
        print(f"  {i}. {agent.name}（agent_id: {agent.id}）")
    choice = await _prompt_choice("番号を選択してください> ", len(agents))
    return agents[choice - 1].id if choice is not None else None


async def _choose_available_agents(session, prompt: str, *, min_count: int = 1):
    """会議中・作業中でない（busyでない）エージェント一覧を表示し、選ばれたAgentのリストを返す。

    カンマ区切りで複数選択できる。`min_count`未満、または未入力・キャンセル（0）の場合は
    空リストではなく`None`を返す（呼び出し側で「キャンセルしました」等を出し分けられるように）。
    """
    agents = await agents_registry.list_agents(session)
    busy_agent_ids = await availability.list_busy_agent_ids(session)
    available_agents = [a for a in agents if a.id not in busy_agent_ids]
    if len(available_agents) < min_count:
        print(
            f"{prompt}（0でキャンセル）\n"
            "空いているエージェントが足りません（会議中・作業中のエージェントは選べません）。"
        )
        return None

    print(f"{prompt}（カンマ区切りで複数可、0でキャンセル）")
    for i, agent in enumerate(available_agents, start=1):
        print(f"  {i}. {agent.name}（agent_id: {agent.id}）")
    while True:
        raw = (await _ainput("番号（カンマ区切り）> ")).strip()
        if raw == "0":
            return None
        tokens = [t.strip() for t in raw.split(",") if t.strip()]
        if (
            len(tokens) >= min_count
            and all(t.isdigit() and 1 <= int(t) <= len(available_agents) for t in tokens)
        ):
            await asyncio.sleep(1)
            return [available_agents[int(t) - 1] for t in dict.fromkeys(tokens)]
        print(f"{min_count}件以上、正しい番号をカンマ区切りで入力してください（キャンセルする場合は0）。")


async def _choose_task(session, prompt: str, tasks=None):
    """お題一覧を表示し、選ばれたTaskを返す（未登録・キャンセル時はNone）。

    `tasks`を渡さない場合は`work.list_tasks`（登録済み全件）から選ぶ。
    """
    if tasks is None:
        tasks = await work.list_tasks(session)
    if not tasks:
        print("登録済みのお題がありません。")
        return None
    print(f"{prompt}（0でキャンセル）")
    for i, task in enumerate(tasks, start=1):
        print(f"  {i}. {task.title}（task_id: {task.id}、{_status_label(task.status)}）")
    choice = await _prompt_choice("番号を選択してください> ", len(tasks))
    return tasks[choice - 1] if choice is not None else None


async def _select_role(session):
    """役職一覧を表示し、選ばれたRoleを返す（キャンセル時はNone）。"""
    roles = await hiring.list_roles(session)
    print("役職を選んでください（0でキャンセル）。")
    for i, role in enumerate(roles, start=1):
        print(f"  {i}. {role.name}")
    choice = await _prompt_choice("番号> ", len(roles))
    return roles[choice - 1] if choice is not None else None


async def _select_ai_model(session, role):
    """役職に応じて絞り込んだAIモデル一覧を表示し、選ばれたAIModelを返す。

    選べるモデルが無い場合、またはキャンセルされた場合はNoneを返す。
    """
    models = await hiring.list_available_ai_models(session, role)
    if not models:
        print("この役職で選べるAIモデルが登録されていません。")
        return None
    print("AIモデルを選んでください（0でキャンセル）。")
    for i, model in enumerate(models, start=1):
        note = "" if model.provider == "deepseek" else "（現状呼び出し未対応）"
        print(f"  {i}. {model.display_name}{note} - {model.description}")
    choice = await _prompt_choice("番号> ", len(models))
    return models[choice - 1] if choice is not None else None


async def _select_skill_ids(session) -> list[int]:
    """スキル一覧を表示し、選ばれたスキルIDのリストを返す（カンマ区切りで複数可、未入力で空リスト）。"""
    skills = await hiring.list_skills(session)
    if not skills:
        return []
    print("スキルを選んでください（カンマ区切りで複数可、未入力でスキルなし）。")
    for i, skill in enumerate(skills, start=1):
        print(f"  {i}. {skill.name} - {skill.description}")
    raw = (await _ainput("番号（カンマ区切り）> ")).strip()
    skill_ids: list[int] = []
    for token in raw.split(","):
        token = token.strip()
        if token.isdigit() and 1 <= int(token) <= len(skills):
            skill_ids.append(skills[int(token) - 1].id)
    await asyncio.sleep(1)
    return skill_ids


# ---------- 社長室 ----------


async def hire_agent_flow() -> None:
    print("\n--- エージェントを作成する ---")
    name = (await _ainput("名前（未入力でキャンセル）> ")).strip()
    if not name:
        print("キャンセルしました。")
        return
    personality = (await _ainput("性格・特徴（一言）> ")).strip()

    async with AsyncSessionLocal() as session:
        role = await _select_role(session)
        if role is None:
            print("キャンセルしました。")
            return
        ai_model = await _select_ai_model(session, role)
        if ai_model is None:
            print("キャンセルしました。")
            return
        skill_ids = await _select_skill_ids(session)

        system_prompt = _build_system_prompt(name, personality, role.name, ai_model.provider)
        agent = await hiring.create_agent(
            session,
            name=name,
            personality=personality,
            role_id=role.id,
            ai_model_id=ai_model.id,
            system_prompt=system_prompt,
            skill_ids=skill_ids,
        )

    print(f"エージェント「{agent.name}」（agent_id: {agent.id}）を雇用しました。")
    if ai_model.provider != "deepseek":
        print(
            f"注意: 選択したAIモデル（{ai_model.display_name}）は現状呼び出しが未実装のため、"
            "このエージェントにお題や会議を依頼するとエラーになります。"
        )


async def issue_task_flow() -> None:
    print("\n--- お題を作成する ---")
    task_text = (await _ainput("お題（未入力でキャンセル）> ")).strip()
    if not task_text:
        print("キャンセルしました。")
        return

    answer = (await _ainput("会議室での話し合いが必要ですか？ (y/N)> ")).strip().lower()
    requires_meeting = answer == "y"

    async with AsyncSessionLocal() as session:
        task = await work.create_task(session, task_text=task_text, requires_meeting=requires_meeting)
    await asyncio.sleep(1)

    if requires_meeting:
        print(f"お題を登録しました（task_id: {task.id}）。会議室で話し合いを行ってください。")
        print("話し合いが終わったら、社長室の「レポートを確認して承認する」から進められます。")
    else:
        print(f"お題を登録しました（task_id: {task.id}）。社長室の「作業を割り当てる」から進められます。")


async def assign_work_flow() -> None:
    print("\n--- 作業を割り当てる ---")
    async with AsyncSessionLocal() as session:
        tasks = await work.list_ready_for_work_tasks(session)
        if not tasks:
            print("作業を割り当てられるお題がありません（会議が必要なお題は、承認が済むまで対象になりません）。")
            return
        print("作業を割り当てるお題を選んでください（0でキャンセル）。")
        for i, task in enumerate(tasks, start=1):
            print(f"  {i}. {task.title}")
        task_choice = await _prompt_choice("番号> ", len(tasks))
        if task_choice is None:
            print("キャンセルしました。")
            return
        task = tasks[task_choice - 1]

        workers = await _choose_available_agents(session, "担当者（worker）を選んでください。")
        if workers is None:
            print("キャンセルしました。")
            return

        if len(workers) == 1:
            leader = workers[0]
        else:
            print("この中からリーダーを選んでください（0でキャンセル）。")
            for i, agent in enumerate(workers, start=1):
                print(f"  {i}. {agent.name}")
            leader_choice = await _prompt_choice("番号> ", len(workers))
            if leader_choice is None:
                print("キャンセルしました。")
                return
            leader = workers[leader_choice - 1]

        try:
            work_session = await work.start_work(
                session,
                task_id=task.id,
                worker_agent_ids=[a.id for a in workers],
                leader_agent_id=leader.id,
            )
        except ValueError as exc:
            print(f"作業を開始できませんでした: {exc}")
            return

    _track_background(work.finish_work(work_session.id))
    print("作業をバックグラウンドで開始しました。完了するとメールに通知が届きます（他の部屋の操作を続けられます）。")
    await asyncio.sleep(1)


async def approve_report_flow() -> None:
    print("\n--- レポートを確認して承認する ---")
    async with AsyncSessionLocal() as session:
        pending = await list_reports_pending_approval(session)
        if not pending:
            print("承認待ちのレポートはありません。")
            return
        print("確認するお題を選んでください（0でキャンセル）。")
        for i, item in enumerate(pending, start=1):
            print(f"  {i}. {item.task.title}")
        choice = await _prompt_choice("番号> ", len(pending))
        if choice is None:
            print("キャンセルしました。")
            return
        item = pending[choice - 1]

        print(f"\n--- 会議レポート（{item.task.title}） ---")
        print(item.report.content)
        await asyncio.sleep(1)

        confirm = (
            await _ainput("このレポートを承認して作業を割り当てられるようにしますか？ (y/N)> ")
        ).strip().lower()
        if confirm != "y":
            print("承認を見送りました。")
            return

        try:
            await approve_report(session, task_id=item.task.id)
        except ValueError as exc:
            print(f"承認できませんでした: {exc}")
            return

    print("レポートを承認しました。社長室の「作業を割り当てる」から進められます。")


def _print_agent_detail(detail) -> None:
    skills_text = "、".join(detail.skill_names) if detail.skill_names else "（なし）"
    print(f"\n■ {detail.agent.name}（agent_id: {detail.agent.id}）")
    print(f"  役職: {detail.role_name}")
    print(f"  使用AIモデル: {detail.ai_model_display_name}")
    print(f"  性格: {detail.agent.personality}")
    print(f"  スキル: {skills_text}")


async def view_agents_flow() -> None:
    print("\n--- 登録エージェント一覧 ---")
    async with AsyncSessionLocal() as session:
        details = await hiring.list_agent_details(session)

    if not details:
        print("登録済みのエージェントがいません。")
        return

    for detail in details:
        _print_agent_detail(detail)
    await asyncio.sleep(1)


async def view_tasks_flow() -> None:
    print("\n--- お題一覧 ---")
    async with AsyncSessionLocal() as session:
        tasks = await work.list_tasks(session)
        if not tasks:
            print("登録済みのお題がありません。")
            return

        for task in tasks:
            created_at = task.created_at.strftime("%Y-%m-%d %H:%M")
            meeting_note = "（会議必要）" if task.requires_meeting else ""
            print(f"\n■ {task.title}（task_id: {task.id}）{meeting_note}")
            status_line = f"  状態: {_status_label(task.status)}"
            if task.status in _IN_PROGRESS_STATUSES:
                names = await availability.get_in_progress_agent_names(session, task.id)
                if names:
                    status_line += f"（担当: {'、'.join(names)}）"
            print(status_line)
            print(f"  登録日時: {created_at}")
    await asyncio.sleep(1)


async def edit_task_flow() -> None:
    print("\n--- お題を編集する ---")
    async with AsyncSessionLocal() as session:
        task = await _choose_task(session, "編集するお題を選んでください。")
        if task is None:
            return

        while True:
            print(f"\n■ {task.title}（task_id: {task.id}）")
            print(f"  状態: {_status_label(task.status)}")
            print(f"  会議要否: {'必要' if task.requires_meeting else '不要'}")
            await asyncio.sleep(1)

            print("\n編集する項目を選んでください。")
            print("  1. お題内容")
            print("  2. 会議要否")
            print("  0. 終了")
            choice = (await _ainput("番号> ")).strip()

            if choice == "0":
                return

            if choice == "1":
                new_text = (await _ainput("新しいお題内容（未入力でキャンセル）> ")).strip()
                if not new_text:
                    print("未入力のため変更しませんでした。")
                    continue
                try:
                    task = await work.update_task(session, task_id=task.id, task_text=new_text)
                except ValueError as exc:
                    print(f"変更できませんでした: {exc}")
                else:
                    print("お題内容を変更しました。")

            elif choice == "2":
                answer = (await _ainput("会議室での話し合いが必要ですか？ (y/N)> ")).strip().lower()
                try:
                    task = await work.update_task(
                        session, task_id=task.id, requires_meeting=(answer == "y")
                    )
                except ValueError as exc:
                    print(f"変更できませんでした: {exc}")
                else:
                    print("会議要否を変更しました。")

            else:
                print("番号が正しくありません。")


async def delete_task_flow() -> None:
    print("\n--- お題を削除する ---")
    async with AsyncSessionLocal() as session:
        task = await _choose_task(session, "削除するお題を選んでください。")
        if task is None:
            return

        confirm = (
            await _ainput(f"本当に「{task.title}」を削除しますか？（関連する会議・成果物も削除されます） (y/N)> ")
        ).strip().lower()
        if confirm != "y":
            print("削除を中止しました。")
            return

        try:
            await work.delete_task(session, task.id)
        except ValueError as exc:
            print(f"削除できませんでした: {exc}")
            return

    print(f"「{task.title}」を削除しました。")


async def edit_agent_flow() -> None:
    print("\n--- エージェントを編集する ---")
    async with AsyncSessionLocal() as session:
        agent_id = await _choose_agent(session, "編集するエージェントを選んでください。")
        if agent_id is None:
            return

        while True:
            detail = await hiring.get_agent_detail(session, agent_id)
            if detail is None:
                print("このエージェントは削除されたようです。")
                return
            _print_agent_detail(detail)
            await asyncio.sleep(1)

            print("\n編集する項目を選んでください。")
            print("  1. 名前")
            print("  2. 性格")
            print("  3. 役職（AIモデルの選び直しが必要です）")
            print("  4. AIモデル")
            print("  5. スキル")
            print("  0. 終了")
            choice = (await _ainput("番号> ")).strip()

            if choice == "0":
                return

            if choice == "1":
                new_name = (await _ainput("新しい名前> ")).strip()
                if not new_name:
                    print("未入力のため変更しませんでした。")
                    continue
                system_prompt = _build_system_prompt(
                    new_name, detail.agent.personality, detail.role_name, detail.agent.ai_model.provider
                )
                await hiring.update_agent(session, agent_id=agent_id, name=new_name, system_prompt=system_prompt)

            elif choice == "2":
                new_personality = (await _ainput("新しい性格・特徴> ")).strip()
                if not new_personality:
                    print("未入力のため変更しませんでした。")
                    continue
                system_prompt = _build_system_prompt(
                    detail.agent.name, new_personality, detail.role_name, detail.agent.ai_model.provider
                )
                await hiring.update_agent(
                    session, agent_id=agent_id, personality=new_personality, system_prompt=system_prompt
                )

            elif choice == "3":
                new_role = await _select_role(session)
                if new_role is None:
                    print("変更しませんでした。")
                    continue
                new_ai_model = await _select_ai_model(session, new_role)
                if new_ai_model is None:
                    print("変更しませんでした。")
                    continue
                system_prompt = _build_system_prompt(
                    detail.agent.name, detail.agent.personality, new_role.name, new_ai_model.provider
                )
                await hiring.update_agent(
                    session,
                    agent_id=agent_id,
                    role_id=new_role.id,
                    ai_model_id=new_ai_model.id,
                    system_prompt=system_prompt,
                )

            elif choice == "4":
                new_ai_model = await _select_ai_model(session, detail.agent.role)
                if new_ai_model is None:
                    print("変更しませんでした。")
                    continue
                system_prompt = _build_system_prompt(
                    detail.agent.name, detail.agent.personality, detail.role_name, new_ai_model.provider
                )
                await hiring.update_agent(
                    session, agent_id=agent_id, ai_model_id=new_ai_model.id, system_prompt=system_prompt
                )

            elif choice == "5":
                skill_ids = await _select_skill_ids(session)
                await hiring.update_agent(session, agent_id=agent_id, skill_ids=skill_ids)

            else:
                print("番号が正しくありません。")


async def delete_agent_flow() -> None:
    print("\n--- エージェントを削除する ---")
    async with AsyncSessionLocal() as session:
        agent_id = await _choose_agent(session, "削除するエージェントを選んでください。")
        if agent_id is None:
            return
        agent = await agents_registry.get_agent(session, agent_id)

        confirm = (await _ainput(f"本当に「{agent.name}」を削除しますか？ (y/N)> ")).strip().lower()
        if confirm != "y":
            print("削除を中止しました。")
            return

        try:
            await hiring.delete_agent(session, agent_id)
        except ValueError as exc:
            print(f"削除できませんでした: {exc}")
            return

    print(f"「{agent.name}」を削除しました。")


async def president_room() -> None:
    while True:
        print("\n[社長室]")
        print("  1. エージェントを作成する（雇用）")
        print("  2. お題を作成する")
        print("  3. 作業を割り当てる")
        print("  4. レポートを確認して承認する")
        print("  5. お題一覧を見る")
        print("  6. お題を編集する")
        print("  7. お題を削除する")
        print("  8. 登録エージェント一覧を見る（性格・役職・スキル・AIモデルを確認）")
        print("  9. エージェントを編集する")
        print("  10. エージェントを削除する")
        print("  0. 部屋選択に戻る")
        choice = (await _ainput("番号> ")).strip()
        if choice == "1":
            await hire_agent_flow()
        elif choice == "2":
            await issue_task_flow()
        elif choice == "3":
            await assign_work_flow()
        elif choice == "4":
            await approve_report_flow()
        elif choice == "5":
            await view_tasks_flow()
        elif choice == "6":
            await edit_task_flow()
        elif choice == "7":
            await delete_task_flow()
        elif choice == "8":
            await view_agents_flow()
        elif choice == "9":
            await edit_agent_flow()
        elif choice == "10":
            await delete_agent_flow()
        elif choice == "0":
            return
        else:
            print("番号が正しくありません。")


# ---------- 会議室 ----------


async def open_meeting_flow() -> None:
    print("\n--- 会議を開く ---")
    async with AsyncSessionLocal() as session:
        tasks = await work.list_awaiting_meeting_tasks(session)
        if not tasks:
            print("会議室での話し合いが必要なお題がありません。先に社長室で「会議室での話し合いが必要」なお題を作成してください。")
            return
        print("会議で話し合うお題を選んでください（社長室で登録済みのものから選びます、0でキャンセル）。")
        for i, task in enumerate(tasks, start=1):
            print(f"  {i}. {task.title}")
        task_choice = await _prompt_choice("番号> ", len(tasks))
        if task_choice is None:
            print("キャンセルしました。")
            return
        task = tasks[task_choice - 1]

        participants = await _choose_available_agents(session, "参加者を選んでください。", min_count=2)
        if participants is None:
            print("キャンセルしました。")
            return

        print("この中からリーダーを選んでください（0でキャンセル）。")
        for i, agent in enumerate(participants, start=1):
            print(f"  {i}. {agent.name}")
        leader_choice = await _prompt_choice("番号> ", len(participants))
        if leader_choice is None:
            print("キャンセルしました。")
            return
        leader = participants[leader_choice - 1]

        try:
            meeting = await start_meeting(
                session,
                task_id=task.id,
                leader_agent_id=leader.id,
                participant_agent_ids=[a.id for a in participants],
            )
        except (RuntimeError, ValueError) as exc:
            print(f"会議を開始できませんでした: {exc}")
            return

    _track_background(finish_meeting(meeting.id))
    print("会議をバックグラウンドで開始しました。完了するとメールに通知が届きます（他の部屋の操作を続けられます）。")
    await asyncio.sleep(1)


async def view_meeting_tasks_flow() -> None:
    print("\n--- 会議が必要なお題一覧 ---")
    async with AsyncSessionLocal() as session:
        tasks = await work.list_awaiting_meeting_tasks(session)

    if not tasks:
        print("会議室での話し合いが必要なお題はありません。")
        return

    for task in tasks:
        created_at = task.created_at.strftime("%Y-%m-%d %H:%M")
        print(f"\n■ {task.title}（task_id: {task.id}）")
        print(f"  登録日時: {created_at}")
    await asyncio.sleep(1)


async def meeting_room() -> None:
    while True:
        print("\n[会議室]")
        print("  1. 会議を開く（リーダー・参加者を選んでエージェント同士で話し合う）")
        print("  2. 会議が必要なお題一覧を見る")
        print("  0. 部屋選択に戻る")
        choice = (await _ainput("番号> ")).strip()
        if choice == "1":
            await open_meeting_flow()
        elif choice == "2":
            await view_meeting_tasks_flow()
        elif choice == "0":
            return
        else:
            print("番号が正しくありません。")


# ---------- 作業室 ----------


async def view_work_flow() -> None:
    print("\n--- 作業内容を確認する ---")
    async with AsyncSessionLocal() as session:
        artifact_views = await work.list_artifacts(session)
        in_progress_items = await work.list_in_progress_work(session)
        if not artifact_views and not in_progress_items:
            print("まだ作業結果がありません。社長室でお題を出してみてください。")
            return

        # 完了・進行中を1つのリストにまとめ、日時の新しい順に並べる。
        # 種類タグを持たせておくことで、選択後にどちらの表示・取得方法を使うか判定できる。
        entries = [("artifact", view, view.artifact.created_at) for view in artifact_views]
        entries += [
            ("in_progress", item, item.work_session.created_at) for item in in_progress_items
        ]
        entries.sort(key=lambda e: e[2], reverse=True)

        for i, (kind, item, created_at) in enumerate(entries, start=1):
            ts = created_at.strftime("%Y-%m-%d %H:%M")
            if kind == "artifact":
                print(f"  {i}. [{ts}] {item.agent_name or '(不明)'} - {item.task_title or '(不明)'}")
            else:
                print(f"  {i}. [{ts}] {item.task_title}（進行中）")

        choice = await _prompt_choice("番号を選択してください（0でキャンセル）> ", len(entries))
        if choice is None:
            print("キャンセルしました。")
            return
        kind, item, _ = entries[choice - 1]

        if kind == "artifact":
            content = item.artifact.content
            agent_name = item.agent_name

    if kind == "artifact":
        print(f"\n--- {agent_name}の作業内容 ---\n{content}")
        await asyncio.sleep(1)
    else:
        await _watch_work_progress(item.work_session.id, item.task_title)


async def _watch_work_progress(work_session_id: int, task_title: str) -> None:
    """進行中の作業をリアルタイムに表示し続ける（`work_progress`を1秒おきにポーリング）。

    トークンが増えた分だけその場に追記していく（`print(..., end="", flush=True)`）ので、
    ターミナル上で実際に生成されていく様子がそのまま流れて見える。作業が完了/失敗すると
    自動的に監視を終了する。Enterキーでもいつでも監視をやめられる（`_enter_pressed`参照。
    Windows以外の環境ではEnterでの中断は効かないが、完了時には必ず終了するので実害はない）。
    """
    print(f"\n--- {task_title}（進行中） ---")
    print("リアルタイムに表示します（Enterキーでいつでも監視をやめられます）。\n")

    # (agent_id, role)をキーにする。リーダーはworkerと兼任することが普通にあるため、
    # agent_idだけで管理すると「担当パート」と「統合作業」の表示が混ざってしまう
    # （`app/services/work_progress.py`参照）。
    printed_keys: set[tuple[int, str]] = set()
    shown_len: dict[tuple[int, str], int] = {}

    while True:
        progress = work_progress.get_progress(work_session_id)
        for key, (agent_name, text) in progress.items():
            _, role = key
            if key not in printed_keys:
                label = "（リーダーとして統合中）" if role == "leader" else ""
                print(f"■ {agent_name}{label}")
                printed_keys.add(key)
                shown_len[key] = 0
            new_text = text[shown_len[key]:]
            if new_text:
                print(new_text, end="", flush=True)
                shown_len[key] = len(text)

        async with AsyncSessionLocal() as session:
            status = await work.get_work_session_status(session, work_session_id)

        if status == "completed":
            print("\n\n（完了しました。メニューに戻ります）")
            break
        if status != "in_progress":
            print("\n\n（作業が終了しました。メニューに戻ります）")
            break
        if _enter_pressed():
            print("\n\n（監視をやめました）")
            break

        await asyncio.sleep(1)


async def work_room() -> None:
    while True:
        print("\n[作業室]")
        print("  1. 作業内容を確認する（実行済みのお題・成果物から選んで内容を見る）")
        print("  0. 部屋選択に戻る")
        choice = (await _ainput("番号> ")).strip()
        if choice == "1":
            await view_work_flow()
        elif choice == "0":
            return
        else:
            print("番号が正しくありません。")


# ---------- メール ----------


async def view_mail_flow() -> None:
    print("\n--- 受信箱を見る ---")
    async with AsyncSessionLocal() as session:
        items = await notifications.list_notifications(session)
        if not items:
            print("通知はありません。")
            return
        for i, item in enumerate(items, start=1):
            created_at = item.thread.created_at.strftime("%Y-%m-%d %H:%M")
            unread_note = "" if item.thread.status == "open" else "（既読）"
            print(f"  {i}. [{created_at}] {item.thread.subject}{unread_note}")
        choice = await _prompt_choice("番号を選択してください（0でキャンセル）> ", len(items))
        if choice is None:
            print("キャンセルしました。")
            return
        item = items[choice - 1]

        print(f"\n--- {item.thread.subject} ---\n{item.body}")
        if item.thread.status == "open":
            await notifications.mark_read(session, item.thread.id)
    await asyncio.sleep(1)


async def mail_room() -> None:
    while True:
        print("\n[メール]")
        print("  1. 受信箱を見る")
        print("  0. 部屋選択に戻る")
        choice = (await _ainput("番号> ")).strip()
        if choice == "1":
            await view_mail_flow()
        elif choice == "0":
            return
        else:
            print("番号が正しくありません。")


# ---------- 部屋選択（トップ） ----------


async def main() -> None:
    while True:
        async with AsyncSessionLocal() as session:
            unread_count = await notifications.count_unread(session)
            meeting_busy = await has_in_progress_meeting(session)
            work_busy = await work.has_in_progress_work(session)

        meeting_room_label = "会議室（使用中）" if meeting_busy else "会議室"
        work_room_label = "作業室（使用中）" if work_busy else "作業室"

        print("\nどの部屋にいますか？")
        print("  1. 社長室")
        print(f"  2. {meeting_room_label}")
        print(f"  3. {work_room_label}")
        print(f"  4. メール（{unread_count}）")
        print("  0. 終了")
        choice = (await _ainput("番号> ")).strip()
        if choice == "1":
            await president_room()
        elif choice == "2":
            await meeting_room()
        elif choice == "3":
            await work_room()
        elif choice == "4":
            await mail_room()
        elif choice == "0":
            if _background_tasks:
                print(
                    f"バックグラウンドで進行中の会議・作業が{len(_background_tasks)}件あります。"
                    "完了を待ってから終了します..."
                )
                await asyncio.gather(*_background_tasks)
            print("終了します。")
            return
        else:
            print("番号が正しくありません。")


if __name__ == "__main__":
    asyncio.run(main())
