"""役割: `agents/`フォルダのペルソナ定義Markdownから、システムプロンプト本文だけを抽出するローダー。

`agents/*.md`は固定フォーマット（「## システムプロンプト」見出し直後にtextコードブロックでシステム
プロンプト本文を書く）で運用される想定。キャラクター設定などパース対象外の部分には関知しない。
"""
from pathlib import Path

# backend-core/app/services/persona.py から見てリポジトリルートは4階層上。
# `app/core/config.py`の`_ENV_FILE`と同様、実行時のカレントディレクトリに依存しない絶対パスにする。
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_AGENTS_DIR = _REPO_ROOT / "agents"


def load_system_prompt(filename: str) -> str:
    """agents/配下のMarkdownファイルから「## システムプロンプト」見出し直後のtextコードブロックを抽出する。"""
    text = (_AGENTS_DIR / filename).read_text(encoding="utf-8")
    _, _, after_heading = text.partition("## システムプロンプト")
    _, _, after_fence = after_heading.partition("```text")
    code_block, _, _ = after_fence.partition("```")
    return code_block.strip()
