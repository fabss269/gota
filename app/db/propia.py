from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import propia_connect_args, settings

propia_engine: AsyncEngine = create_async_engine(
    settings.propia_db_url, pool_pre_ping=True, connect_args=propia_connect_args()
)

PropiaSessionFactory = async_sessionmaker(propia_engine, expire_on_commit=False)


async def get_propia_session() -> AsyncGenerator[AsyncSession, None]:
    async with PropiaSessionFactory() as session:
        yield session
