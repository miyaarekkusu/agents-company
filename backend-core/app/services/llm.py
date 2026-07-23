"""外部LLM API呼び出しの薄いラッパー。まずはDeepSeekのみ対応する。"""
from openai import AsyncOpenAI

from app.core.config import settings

_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
_DEEPSEEK_MODEL = "deepseek-v4-pro"


async def call_deepseek(prompt: str) -> str:
    """DeepSeek API(OpenAI互換)にプロンプトを送り、応答テキストを返す。"""
    client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=_DEEPSEEK_BASE_URL)
    response = await client.chat.completions.create(
        model=_DEEPSEEK_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""
