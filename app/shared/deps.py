from collections.abc import Callable
from datetime import date
from typing import Annotated

from fastapi import Depends, Header, Query
from pydantic import BaseModel
from redis.asyncio import Redis as RedisClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermisosInsuficientesError, TokenExpiradoError
from app.core.security import decode_token
from app.db.models_propia import Usuario
from app.db.propia import get_propia_session
from app.db.redis import redis_client
from app.db.sig import get_sig_session

PropiaSession = Annotated[AsyncSession, Depends(get_propia_session)]
SigSession = Annotated[AsyncSession, Depends(get_sig_session)]


def get_redis() -> RedisClient:
    return redis_client


RedisDep = Annotated[RedisClient, Depends(get_redis)]


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise TokenExpiradoError()
    return authorization.removeprefix("Bearer ").strip()


async def get_current_user(
    session: PropiaSession,
    authorization: Annotated[str | None, Header()] = None,
) -> Usuario:
    token = _extract_bearer_token(authorization)
    usuario_id = decode_token(token, expected_type="access")

    usuario = await session.get(Usuario, usuario_id)
    if usuario is None or not usuario.activo:
        raise TokenExpiradoError()
    return usuario


CurrentUser = Annotated[Usuario, Depends(get_current_user)]


def require_role(*codigos: str) -> Callable[[Usuario], Usuario]:
    def _dependency(usuario: CurrentUser) -> Usuario:
        if usuario.rol.codigo not in codigos:
            raise PermisosInsuficientesError()
        return usuario

    return _dependency


class IncidenciaFilterParams(BaseModel):
    """Query params de `GET /incidencias` (API.md §3) — un único punto de parseo,
    compartido por el service en vez de que el router pase parámetros sueltos."""

    fecha: str | None = None
    fechaDesde: date | None = None
    fechaHasta: date | None = None
    categoria: str | None = None
    prioridad: str | None = None
    estado: str | None = None
    distritoId: str | None = None
    sectorId: str | None = None
    tipoAtencionId: str | None = None
    q: str | None = None
    bbox: str | None = None
    page: int = 1
    pageSize: int = 10

    def csv(self, campo: str | None) -> list[str] | None:
        return campo.split(",") if campo else None

    def bbox_tuple(self) -> tuple[float, float, float, float] | None:
        if not self.bbox:
            return None
        min_lon, min_lat, max_lon, max_lat = (float(v) for v in self.bbox.split(","))
        return (min_lon, min_lat, max_lon, max_lat)


def incidencia_filter_params(
    fecha: Annotated[str | None, Query()] = None,
    fechaDesde: Annotated[date | None, Query()] = None,
    fechaHasta: Annotated[date | None, Query()] = None,
    categoria: Annotated[str | None, Query()] = None,
    prioridad: Annotated[str | None, Query()] = None,
    estado: Annotated[str | None, Query()] = None,
    distritoId: Annotated[str | None, Query()] = None,
    sectorId: Annotated[str | None, Query()] = None,
    tipoAtencionId: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    bbox: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=100)] = 10,
) -> IncidenciaFilterParams:
    return IncidenciaFilterParams(
        fecha=fecha,
        fechaDesde=fechaDesde,
        fechaHasta=fechaHasta,
        categoria=categoria,
        prioridad=prioridad,
        estado=estado,
        distritoId=distritoId,
        sectorId=sectorId,
        tipoAtencionId=tipoAtencionId,
        q=q,
        bbox=bbox,
        page=page,
        pageSize=pageSize,
    )


IncidenciaFilters = Annotated[IncidenciaFilterParams, Depends(incidencia_filter_params)]
