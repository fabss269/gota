from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.db.models_propia import Usuario
from app.modules.catalogos.sig_repository import SigCatalogoRepository
from app.modules.grafo.repository import GrafoRepository
from app.modules.grafo.service import GrafoService
from app.modules.incidencias.cache_repository import IncidenciaCacheRepository
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.modules.incidencias.propia_repository import PropiaIncidenciaRepository
from app.modules.incidencias.schemas import (
    AvanceRequest,
    EstadoPatchRequest,
    IncidenciaDetalleOut,
    IncidenciaListResponse,
    IncidenciaOut,
    PredioReclamoOut,
    ResponsablePatchRequest,
    TransicionOut,
    TrazabilidadPasoOut,
)
from app.modules.incidencias.service import IncidenciaService
from app.shared.deps import (
    CurrentUser,
    IncidenciaFilters,
    PropiaSession,
    RedisDep,
    SigSession,
    require_role,
)

router = APIRouter(prefix="/incidencias", tags=["incidencias"])

RequireSupervisor = Annotated[Usuario, Depends(require_role("supervisor"))]


def _get_service(session: PropiaSession, sig_session: SigSession, redis: RedisDep) -> IncidenciaService:
    return IncidenciaService(
        PropiaIncidenciaRepository(session),
        IncidenciaCacheRepository(redis),
        CatastroEnrichmentService(sig_session),
        SigCatalogoRepository(sig_session),
        GrafoService(GrafoRepository(session)),
    )


@router.get("", response_model=IncidenciaListResponse)
async def listar(
    filtros: IncidenciaFilters,
    session: PropiaSession,
    sig_session: SigSession,
    redis: RedisDep,
    _usuario: CurrentUser,
) -> IncidenciaListResponse:
    return await _get_service(session, sig_session, redis).listar(filtros)


@router.get("/{codigo}", response_model=IncidenciaDetalleOut)
async def detalle(
    codigo: str, session: PropiaSession, sig_session: SigSession, redis: RedisDep, _usuario: CurrentUser
) -> IncidenciaDetalleOut:
    return await _get_service(session, sig_session, redis).detalle(codigo)


@router.get("/{codigo}/trazabilidad", response_model=list[TrazabilidadPasoOut])
async def trazabilidad(
    codigo: str, session: PropiaSession, sig_session: SigSession, redis: RedisDep, _usuario: CurrentUser
) -> list[TrazabilidadPasoOut]:
    return await _get_service(session, sig_session, redis).trazabilidad(codigo)


@router.get("/{codigo}/predio", response_model=list[PredioReclamoOut])
async def predio(
    codigo: str, session: PropiaSession, sig_session: SigSession, redis: RedisDep, _usuario: CurrentUser
) -> list[PredioReclamoOut]:
    return await _get_service(session, sig_session, redis).predio(codigo)


@router.get("/{codigo}/transiciones-validas", response_model=list[TransicionOut])
async def transiciones_validas(
    codigo: str, session: PropiaSession, sig_session: SigSession, redis: RedisDep, _usuario: CurrentUser
) -> list[TransicionOut]:
    return await _get_service(session, sig_session, redis).transiciones_validas(codigo)


@router.post("/{codigo}/avances", response_model=TrazabilidadPasoOut, status_code=status.HTTP_201_CREATED)
async def registrar_avance(
    codigo: str,
    body: AvanceRequest,
    session: PropiaSession,
    sig_session: SigSession,
    redis: RedisDep,
    usuario: CurrentUser,
) -> TrazabilidadPasoOut:
    return await _get_service(session, sig_session, redis).registrar_avance(codigo, body, usuario)


@router.patch("/{codigo}/estado", response_model=IncidenciaOut)
async def cambiar_estado(
    codigo: str,
    body: EstadoPatchRequest,
    session: PropiaSession,
    sig_session: SigSession,
    redis: RedisDep,
    _usuario: CurrentUser,
) -> IncidenciaOut:
    return await _get_service(session, sig_session, redis).cambiar_estado(codigo, body)


@router.patch("/{codigo}/responsable", response_model=IncidenciaOut)
async def reasignar_responsable(
    codigo: str,
    body: ResponsablePatchRequest,
    session: PropiaSession,
    sig_session: SigSession,
    redis: RedisDep,
    _usuario: RequireSupervisor,
) -> IncidenciaOut:
    return await _get_service(session, sig_session, redis).reasignar_responsable(codigo, body)
