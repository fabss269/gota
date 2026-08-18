from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

sig_engine: AsyncEngine = create_async_engine(settings.sig_db_url_effective, pool_pre_ping=True)

SigSessionFactory = async_sessionmaker(sig_engine, expire_on_commit=False)


async def get_sig_session() -> AsyncGenerator[AsyncSession, None]:
    """Sesión de solo lectura contra `sig` (bd_conhydra).

    `SET TRANSACTION READ ONLY` es defensa en profundidad mientras no exista un rol
    de Postgres dedicado de solo lectura en esa BD (pendiente con el equipo de Edgar,
    ver specs/00-arquitectura.md §1) — no reemplaza pedir ese rol.
    """
    async with SigSessionFactory() as session:
        await session.execute(text("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY"))
        yield session


async def get_sig_write_session() -> AsyncGenerator[AsyncSession, None]:
    """Excepción explícita y acotada al READ ONLY de arriba — decisión de Edgar
    2026-08-07: la edición inline de diámetro/material de tramos (agua/
    alcantarillado) escribe directo sobre `sig.agua`/`sig.alcantarillado`, sabiendo
    que un restore futuro de un backup de Fabiana pisa esos valores sin aviso (no
    hay tabla de "correcciones" separada — se evaluó y se descartó). Usar
    ÚNICAMENTE desde `app/modules/red/router.py` (el PATCH de edición) — cualquier
    otro acceso de escritura a `sig` necesita la misma conversación explícita, no
    asumir que esta sesión es de uso general."""
    async with SigSessionFactory() as session:
        yield session
        await session.commit()
