"""ターミナルから直接LangGraphのグラフと対話して動作確認するための簡易CLI。

サーバー起動やcurlは不要。backend-core直下で(venvを有効化した状態で)
`python scripts/chat.py` を実行する。
"""
import asyncio
import sys

from app.services.graph import graph

# Windows環境で標準入出力がUTF-8以外になる場合があるため明示的に指定する。
sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")


async def main() -> None:
    print("お題を入力してください。何も入力せずEnterで終了します。")
    while True:
        task = input("お題> ").strip()
        if not task:
            break
        state = await graph.ainvoke({"task": task, "result": ""})
        print(f"結果> {state['result']}\n")


if __name__ == "__main__":
    asyncio.run(main())
