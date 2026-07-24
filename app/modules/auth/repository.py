from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models_propia import Usuario


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_correo_o_username(self, correo: str) -> Usuario | None:
        stmt = select(Usuario).where(or_(Usuario.email == correo, Usuario.username == correo))
        return await self._session.scalar(stmt)

    async def get_by_id(self, usuario_id: str) -> Usuario | None:
        return await self._session.get(Usuario, usuario_id)

    async def marcar_ultimo_login(self, usuario: Usuario) -> None:
        # `ultimo_login` es `timestamp without time zone` en el DDL — se guarda naive,
        # en UTC por convención (asyncpg rechaza un datetime con tzinfo ahí).
        usuario.ultimo_login = datetime.now(UTC).replace(tzinfo=None)
        await self._session.commit()
