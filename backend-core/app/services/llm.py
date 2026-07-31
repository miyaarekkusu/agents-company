"""役割: 外部LLM API呼び出しの薄いラッパー層。まずはDeepSeekのみ対応する。

LangGraphの知識は一切持たない、ただの「プロンプト文字列を渡すと応答文字列が返る」関数群。
`app/services/graph.py`・`app/services/meeting_graph.py`のノードから呼び出される想定。
他プロバイダ（Claude/OpenAI/Gemini）を追加する際は、`call_deepseek`と同じ形の
`call_xxx(prompt: str) -> str`関数をここに並べて実装した上で、`call_llm`の振り分け先に加える。
"""
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.core.config import settings
from app.models.agent import Agent

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


async def call_llm(agent: Agent, prompt: str) -> str:
    """`agent.ai_model.provider`に応じてLLM呼び出しを振り分ける。

    現状"deepseek"のみ実装済み。それ以外のプロバイダ（claude等）は`ai_models`テーブルに
    マスタ登録のみされていて実際の呼び出しは未実装のため、NotImplementedErrorを送出する
    （呼び出し側で分かりやすく案内する想定）。

    `agent.ai_model`にアクセスするため、呼び出し側は`Agent`取得時に`ai_model`を
    ロード済みにしておく必要がある（`session.get(Agent, id)`だけだとlazy loadになりうる点に
    注意し、`selectinload(Agent.ai_model)`等を使うこと）。
    """
    if agent.ai_model.provider == "deepseek":
        return await call_deepseek(prompt, system_prompt=agent.system_prompt)
    raise NotImplementedError(f"プロバイダ '{agent.ai_model.provider}' はまだ実装されていません")


async def stream_deepseek(prompt: str, system_prompt: str | None = None) -> AsyncIterator[str]:
    """`call_deepseek`のストリーミング版。応答をトークン単位のasyncジェネレータで返す。

    作業室（`app/services/work_graph.py`）で生成途中の内容を進行状況ストアに反映するため、
    応答が返り切るまで待たずに逐次yieldする必要があり別関数として用意した
    （`call_deepseek`は他所（会議室）で使われているため変更しない）。
    """
    messages = []
    if system_prompt is not None:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=_DEEPSEEK_BASE_URL)
    stream = await client.chat.completions.create(
        model=_DEEPSEEK_MODEL,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content


async def stream_llm(agent: Agent, prompt: str) -> AsyncIterator[str]:
    """`call_llm`と同じprovider振り分けのストリーミング版（`stream_deepseek`へ委譲）。"""
    if agent.ai_model.provider == "deepseek":
        async for token in stream_deepseek(prompt, system_prompt=agent.system_prompt):
            yield token
        return
    raise NotImplementedError(f"プロバイダ '{agent.ai_model.provider}' はまだ実装されていません")
