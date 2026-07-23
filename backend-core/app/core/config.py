"""アプリケーション設定。環境変数 / .env から読み込む。"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- アプリ ---
    APP_NAME: str = "ai-company-backend-core"
    ENV: str = "development"
    DEBUG: bool = True

    # --- CORS ---
    # フロントエンドの開発サーバーからのアクセスを許可するオリジン（カンマ区切り）
    CORS_ORIGINS: str = "http://localhost:5173"

    # --- データベース ---
    # デフォルトはローカル開発用Postgres宛て。/health の動作には必須ではない。
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_company"

    # --- LLMプロバイダ ---
    # エージェントごとに異なるプロバイダを割り当てられる。起動時に未設定でも問題ない。
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    DEEPSEEK_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
