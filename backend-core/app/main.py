"""役割: FastAPIアプリのエントリポイント。ルーター登録・CORS設定・ヘルスチェックのみを担当する。

各エンドポイントの実処理はここに書かず、`app/api/`配下のルーターに実装し、ここではinclude_routerするだけにする。
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agents import router as agents_router
from app.api.mail import router as mail_router
from app.api.meetings import router as meetings_router
from app.api.tasks import router as tasks_router
from app.api.work import router as work_router
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)
app.include_router(tasks_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(meetings_router, prefix="/api")
app.include_router(work_router, prefix="/api")
app.include_router(mail_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Docker/venvどちらでもサーバーが起動しているかを確認するための疎通確認用エンドポイント。"""
    return {"status": "ok"}
