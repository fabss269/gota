import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models_propia import EstadoIncidenteEvento, Incidente, Rol, Usuario


class UsuarioRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def listar(self, roles: list[str] | None) -> list[Usuario]:
        stmt = select(Usuario).join(Usuario.rol).where(Usuario.activo.is_(True))
        if roles:
            stmt = stmt.where(Rol.codigo.in_(roles))
        stmt = stmt.order_by(Usuario.nombres, Usuario.apellidos)
        return list(await self._session.scalars(stmt))

    async def mapa_ultimo_incidente(self, usuario_ids: list[uuid.UUID]) -> dict[uuid.UUID, uuid.UUID]:
        """Incidente más reciente donde cada usuario quedó asignado (specs/06): "el
        usuario está relacionado a evento, evento a incidencia, y la incidencia tiene
        su suministro, del cual se puede sacar el sector"."""
        if not usuario_ids:
            return {}
        stmt = (
            select(EstadoIncidenteEvento.usuario_id, EstadoIncidenteEvento.incidente_id)
            .distinct(EstadoIncidenteEvento.usuario_id)
            .where(EstadoIncidenteEvento.usuario_id.in_(usuario_ids))
            .order_by(EstadoIncidenteEvento.usuario_id, EstadoIncidenteEvento.fecha.desc())
        )
        filas = await self._session.execute(stmt)
        return {row.usuario_id: row.incidente_id for row in filas}

    async def get_incidentes_por_ids(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, Incidente]:
        if not ids:
            return {}
        stmt = select(Incidente).join(Incidente.tipo_atencion).where(Incidente.incidente_id.in_(ids))
        filas = await self._session.scalars(stmt)
        return {i.incidente_id: i for i in filas}
