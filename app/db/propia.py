from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

propia_engine: AsyncEngine = create_async_engine(settings.propia_db_url, pool_pre_ping=True)

PropiaSessionFactory = async_sessionmaker(propia_engine, expire_on_commit=False)


async def get_propia_session() -> AsyncGenerator[AsyncSession, None]:
    async with PropiaSessionFactory() as session:
        yield session
