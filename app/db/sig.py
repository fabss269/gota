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
