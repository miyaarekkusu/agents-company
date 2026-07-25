"""役割: 外部LLM API呼び出しの薄いラッパー層。まずはDeepSeekのみ対応する。

LangGraphの知識は一切持たない、ただの「プロンプト文字列を渡すと応答文字列が返る」関数群。
`app/services/graph.py`のノードから呼び出される想定。他プロバイダ（Claude/OpenAI/Gemini）を
追加する際は、`call_deepseek`と同じ形の`call_xxx(prompt: str) -> str`関数をここに並べて実装する。
"""
from openai import AsyncOpenAI

from app.core.config import settings

_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
_DEEPSEEK_MODEL = "deepseek-v4-pro"


async def call_deepseek(prompt: str, system_prompt: str | None = None) -> str:
    """DeepSeek API(OpenAI互換)にプロンプトを送り、応答テキストを返す。

    DeepSeekはOpenAI互換のAPI仕様を提供しているため、`openai`SDKの`base_url`を
    DeepSeek側のエンドポイントに差し替えるだけで呼び出せる（LangChain本体は不要）。

    `system_prompt`を指定すると、`messages`の先頭に`role: system`のメッセージとして
    追加される（キャラクター性の付与に使う）。未指定の場合はuserメッセージのみを送る。
    """
    messages = []
    if system_prompt is not None:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=_DEEPSEEK_BASE_URL)
    response = await client.chat.completions.create(
        model=_DEEPSEEK_MODEL,
        messages=messages,
    )
    return response.choices[0].message.content or ""
