"""SQLAlchemy(非同期)のエンジン/セッション設定（asyncpg経由でPostgreSQLに接続）。"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# echo=DEBUGのみ設定。エンジン作成時点では接続を開かないため、
# Postgresがまだ起動していない状態でimportしても問題ない。
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """全ORMモデルの基底クラス。"""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """DBセッションを提供するFastAPI依存関係。"""
    async with AsyncSessionLocal() as session:
        yield session
