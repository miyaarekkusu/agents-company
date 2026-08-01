"""役割: バックグラウンドで実行するコルーチンを安全に起動するための共通ヘルパー。

会議(`app/services/meetings.py`の`finish_meeting`)・作業(`app/services/work.py`の
`finish_work`)は、LLM呼び出しに時間がかかるためHTTPレスポンスをブロックせず
`asyncio.create_task(...)`でバックグラウンド実行し、呼び出し側は`await`しない。

`asyncio.create_task`が返す`Task`への参照を誰も保持していないと、実行中でも
ガベージコレクションの対象になり、タスクが途中で消えてしまうことがある
（asyncio公式ドキュメントに記載された既知の落とし穴）。これを防ぐため、
モジュール変数の`set`に参照を保持し続け、完了時に`add_done_callback`で
自動的に取り除く。`backend-core/scripts/game_cli.py`の`_track_background`/
`_background_tasks`と同じパターン。
"""
import asyncio
from collections.abc import Coroutine
from typing import Any

# バックグラウンドで実行中の会議・作業タスク（finish_meeting/finish_work等）を保持する。
_background_tasks: set[asyncio.Task] = set()


def track_background(coro: Coroutine[Any, Any, Any]) -> None:
    """コルーチンをバックグラウンドタスクとして起動する（呼び出し側は待たずに即座に戻る）。"""
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
