from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Kenza trichologist center"
    app_env: str = "development"
    secret_key: str = "change-me-in-production-use-a-long-random-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    database_url: str = "sqlite+aiosqlite:///./haircare.db"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    pharmacy_base_url: str = "https://pharmacy.example.com"
    frontend_url: str = "http://localhost:3000"
    default_admin_email: str = "admin@haircare.com"
    default_admin_password: str = "Admin123!"

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
