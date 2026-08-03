from typing import Annotated

from fastapi import APIRouter, Query

from app.core.exceptions import NoEncontradoError
from app.modules.grafo.repository import GrafoRepository
from app.modules.grafo.schemas import (
    FocoActivoOut,
    ImpactoOut,
    SimulacionOut,
    SimulacionRequest,
    TipoRed,
)
from app.modules.grafo.service import GrafoService
from app.modules.incidencias.propia_repository import PropiaIncidenciaRepository
from app.shared.deps import CurrentUser, PropiaSession

router = APIRouter(prefix="/grafo", tags=["grafo"])


def _get_service(session: PropiaSession) -> GrafoService:
    return GrafoService(GrafoRepository(session))


@router.get("/incidencias/{codigo}/impacto", response_model=ImpactoOut)
async def impacto_incidencia(codigo: str, session: PropiaSession, _usuario: CurrentUser) -> ImpactoOut:
    incidente = await PropiaIncidenciaRepository(session).get_by_codigo(codigo)
    if incidente is None:
        raise NoEncontradoError(f"Incidencia {codigo} no encontrada")
    categoria = incidente.tipo_atencion.tipo_grupo.codigo
    return await _get_service(session).impacto_incidencia(
        incidente.suministro_codigo, categoria, incidente.tipo_atencion.codigo
    )


@router.get("/focos", response_model=list[FocoActivoOut])
async def focos_activos(
    session: PropiaSession,
    _usuario: CurrentUser,
    tipoRed: Annotated[TipoRed, Query()],
    dias: Annotated[int, Query(ge=1)] = 7,
    minReclamos: Annotated[int, Query(ge=1)] = 3,
) -> list[FocoActivoOut]:
    return await _get_service(session).focos_activos(tipoRed, dias, minReclamos)


@router.post("/simulacion", response_model=SimulacionOut)
async def simular(body: SimulacionRequest, session: PropiaSession, _usuario: CurrentUser) -> SimulacionOut:
    return await _get_service(session).simular_con_red(body.tipoFalla, body.elementoId)
