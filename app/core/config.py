from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ------------------------------------------------------------------------
    # Conexion Postgres — compartida por BD principal y datamart (mismo servidor)
    # ------------------------------------------------------------------------
    db_host: str
    db_port: int = 5432
    db_user: str
    db_password: str

    # BD principal — contiene AMBOS schemas (gota + sig)
    db_name: str

    # Schema donde viven las tablas propias de GOTA
    propia_db_schema: str = "gota"

    # BD del datamart — opcional (mismo host/port/user/password que la principal,
    # solo distinto nombre). None si no está configurado.
    datamart_name: str | None = None

    # ------------------------------------------------------------------------
    # Auth y misc
    # ------------------------------------------------------------------------
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

    # ------------------------------------------------------------------------
    # URLs computadas
    # ------------------------------------------------------------------------
    @property
    def db_url(self) -> str:
        """URL de la BD principal (formato asyncpg para SQLAlchemy async)."""
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def propia_db_url(self) -> str:
        """Alias — código legacy sigue usando propia_db_url."""
        return self.db_url

    @property
    def sig_db_url_effective(self) -> str:
        """URL para el engine SIG. Sig vive en el mismo servidor que gota (schema
        distinto de la misma BD)."""
        return self.db_url

    @property
    def datamart_db_url(self) -> str | None:
        """URL del datamart. None si no está configurado el DATAMART_NAME."""
        if not self.datamart_name:
            return None
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.datamart_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def propia_connect_args() -> dict:
    """`connect_args` compartido por todo lo que abre una conexión a la BD propia
    (engine de la app, scripts de seed/carga) — fija el `search_path` al schema
    correcto (`gota` por default) sin depender de que cada query califique la tabla
    explícitamente."""
    return {"server_settings": {"search_path": settings.propia_db_schema}}
