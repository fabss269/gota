from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    propia_db_url: str

    sig_db_host: str
    sig_db_port: int = 15432
    sig_db_name: str
    sig_db_user: str
    sig_db_password: str

    jwt_secret: str
    jwt_access_expires_seconds: int = 3600
    jwt_refresh_expires_seconds: int = 2592000

    redis_url: str = "redis://localhost:6379/0"

    # Heurística de incidencias relacionadas (quejasAgrupadas/foco, specs/04) —
    # confirmado con Edgar 2026-07-24: 150m / 30 días como default configurable.
    quejas_radio_metros: float = 150.0
    quejas_ventana_dias: int = 30
    quejas_max_relacionadas: int = 10

    @property
    def sig_db_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.sig_db_user}:{self.sig_db_password}"
            f"@{self.sig_db_host}:{self.sig_db_port}/{self.sig_db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
