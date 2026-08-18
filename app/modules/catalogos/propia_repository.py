from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models_propia import CatalogoEstado, CatalogoTipoAtencion, CatalogoTipoGrupo


class PropiaCatalogoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def listar_tipos_grupo(self) -> list[CatalogoTipoGrupo]:
        stmt = select(CatalogoTipoGrupo).order_by(CatalogoTipoGrupo.tipo_grupo_id)
        result = await self._session.scalars(stmt)
        return list(result)

    async def listar_tipos_atencion(self) -> list[CatalogoTipoAtencion]:
        stmt = (
            select(CatalogoTipoAtencion)
            .where(CatalogoTipoAtencion.activo.is_(True))
            .order_by(CatalogoTipoAtencion.nombre)
        )
        result = await self._session.scalars(stmt)
        return list(result)

    async def listar_estados(self) -> list[CatalogoEstado]:
        stmt = (
            select(CatalogoEstado)
            .where(CatalogoEstado.activo.is_(True))
            .order_by(CatalogoEstado.orden)
        )
        result = await self._session.scalars(stmt)
        return list(result)
