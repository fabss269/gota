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

    # Tope de incidencias relacionadas devueltas en `foco.incidenciasRelacionadasIds`
    # (quejasAgrupadas/foco, ahora por causa raíz de grafo — ver app/modules/grafo).
    quejas_max_relacionadas: int = 10

    # ------------------------------------------------------------------------
    # Ingest DANA (2026-08-04) — hoy apunta a dana_mock/ (simulación, mientras DANA
    # no nos da acceso a su API real). Cuando lo hagan, solo cambia esta URL.
    # ------------------------------------------------------------------------
    dana_api_base_url: str = "http://localhost:8100"
    # Segundos entre cada pull automático (scheduler interno, ver
    # app/core/scheduler.py). Decisión 2026-08-04 con Edgar: cadencia rápida (30s)
    # para que el pipeline completo sea observable en minutos — dana_mock/ emite un
    # ticket nuevo cada 5s (ver dana_mock/generator.py TICK_SEGUNDOS), así que cada
    # pull trae ~6 tickets nuevos en promedio.
    dana_poll_interval_seconds: float = 30
    # Margen de solapamiento hacia atrás sobre el checkpoint (MAX(fecha_registro) ya
    # cargado) al calcular `fecha_desde` del próximo pull — defensivo ante relojes
    # desincronizados entre este servidor y DANA; el dedup por TICKET en
    # tickets_loader hace que reprocesar el solape sea inofensivo, solo desperdicia
    # una comparación, no una escritura.
    dana_poll_overlap_seconds: float = 10

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
