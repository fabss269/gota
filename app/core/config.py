from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    propia_db_url: str
    # Schema donde viven las tablas propias de GOTA. Default "public" preserva el
    # comportamiento de dev local (BD "gota" standalone, tablas sin schema explícito).
    # En producción, GOTA vive como esquema "gota" dentro de bd_conhydra (junto a "sig") →
    # PROPIA_DB_SCHEMA=gota.
    propia_db_schema: str = "public"

    sig_db_host: str
    sig_db_port: int = 5432
    sig_db_name: str
    sig_db_user: str
    sig_db_password: str

    jwt_secret: str
    jwt_access_expires_seconds: int = 3600
    jwt_refresh_expires_seconds: int = 2592000

    redis_url: str = "redis://localhost:6379/0"

    # Origen del frontend en producción (ej. "https://gota.epsel.gob.pe") — se suma
    # al regex de localhost ya permitido para dev. None (default) = solo dev local.
    allowed_origin: str | None = None

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


def propia_connect_args() -> dict:
    """`connect_args` compartido por todo lo que abre una conexión a la BD propia
    (engine de la app, scripts de seed/carga) — fija el `search_path` al schema
    correcto (`public` en dev local, `gota` en producción) sin depender de que cada
    query califique la tabla explícitamente."""
    return {"server_settings": {"search_path": settings.propia_db_schema}}
