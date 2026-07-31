"""役割: 作業室でバックグラウンド実行中の作業(work_session)の生成途中の内容を、
プロセス内メモリで保持する（進行状況ストア）。

会議・作業はいずれもCLIプロセス内のasyncioイベントループ上で完結するため
（`asyncio.run(main())`一つで全体が動く）、バックグラウンドタスク
（`app/services/work.py`の`finish_work`）が生成したトークンを、同じプロセス内の
別のメニュー操作（作業室での閲覧、`scripts/game_cli.py`）からそのまま読み取れる。
DB永続化・HTTP通信は不要（プロセスを跨がないため）。

キーは`agent_id`単体ではなく`(agent_id, role)`にしている。リーダーはworkerと兼任する
ことが普通にあり（同じagent_id）、`agent_id`だけをキーにすると「workerとしての担当
パート」と「リーダーとしての統合作業」が同じ項目に混ざってしまう（`app/services/
work_graph.py`が流す`role`（"worker"/"leader"）で区別する）。
"""

_progress: dict[int, dict[tuple[int, str], tuple[str, str]]] = {}
# work_session_id -> {(agent_id, role): (agent_name, ここまでの累積テキスト)}


def record_token(work_session_id: int, agent_id: int, role: str, agent_name: str, token: str) -> None:
    """該当エージェント・役割の累積テキストにトークンを追記する。"""
    bucket = _progress.setdefault(work_session_id, {})
    key = (agent_id, role)
    _, prev_text = bucket.get(key, (agent_name, ""))
    bucket[key] = (agent_name, prev_text + token)


def record_final(work_session_id: int, agent_id: int, role: str, agent_name: str, content: str) -> None:
    """該当エージェント・役割の内容を確定値で上書きする（ストリーミング中の丸め誤差を無くすため）。"""
    bucket = _progress.setdefault(work_session_id, {})
    bucket[(agent_id, role)] = (agent_name, content)


def get_progress(work_session_id: int) -> dict[tuple[int, str], tuple[str, str]]:
    """現時点のスナップショットを返す（{(agent_id, role): (agent_name, 累積テキスト)}）。"""
    return dict(_progress.get(work_session_id, {}))


def clear_progress(work_session_id: int) -> None:
    """作業が完了/失敗した後、不要になった進行状況を破棄する。"""
    _progress.pop(work_session_id, None)
