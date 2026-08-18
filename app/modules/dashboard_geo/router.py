from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.modules.dashboard_geo.repository import DashboardGeoRepository
from app.modules.dashboard_geo.schemas import (
    AlertaOut,
    DistritoRoboOut,
    HeatmapSectorOut,
    IncidenciaPopupOut,
    KpisOut,
    MultiReclamoOut,
    ParentescoSliceOut,
    PrediccionSectorOut,
    PuntoHeatmapOut,
    ReincidenteOut,
    SectorRankOut,
    SerieMensualOut,
    SerieStackedOut,
    SerieTiempoResolucionOut,
    SinSolucionRowOut,
    SliceOut,
    StorytellingOut,
    TramoRankOut,
)
from app.modules.dashboard_geo.service import DashboardGeoService
from app.shared.deps import PropiaSession, require_role

router = APIRouter(
    prefix="/dashboard-v2",
    tags=["dashboard-v2"],
    dependencies=[Depends(require_role("supervisor", "admin"))],
)

Periodo = Literal["anual", "mensual"]
Grupo = Literal["agua", "desague", "todos"]


def _svc(session: PropiaSession) -> DashboardGeoService:
    return DashboardGeoService(DashboardGeoRepository(session))


# ---------------- Popup ----------------

@router.get("/incidencia/{codigo}/popup", response_model=IncidenciaPopupOut)
async def popup_incidencia(codigo: str, session: PropiaSession) -> IncidenciaPopupOut:
    return await _svc(session).popup(codigo)


# ---------------- KPIs ----------------

@router.get("/kpis", response_model=KpisOut)
async def kpis(
    session: PropiaSession,
    periodo: Annotated[Periodo, Query()] = "anual",
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
    anio: Annotated[int | None, Query(ge=2020, le=2100)] = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> KpisOut:
    g = None if grupo == "todos" else grupo
    return await _svc(session).kpis(periodo, g, sectorid, anio, mes)


# ---------------- Storytelling ----------------

@router.get("/storytelling", response_model=StorytellingOut)
async def storytelling(
    session: PropiaSession,
    periodo: Annotated[Periodo, Query()] = "anual",
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
    anio: Annotated[int | None, Query(ge=2020, le=2100)] = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> StorytellingOut:
    g = None if grupo == "todos" else grupo
    return await _svc(session).storytelling(periodo, g, sectorid, anio, mes)


# ---------------- Sectores ----------------

@router.get("/sectores", response_model=list[SectorRankOut])
async def sectores(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    limite: Annotated[int, Query(ge=1, le=50)] = 10,
    distrito_id: Annotated[str | None, Query(alias="distritoId")] = None,
    provincia_id: Annotated[str | None, Query(alias="provinciaId")] = None,
) -> list[SectorRankOut]:
    g = None if grupo == "todos" else grupo
    return await _svc(session).sectores(limite, g, distrito_id, provincia_id)


@router.get("/heatmap-sectores", response_model=list[HeatmapSectorOut])
async def heatmap_sectores(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
) -> list[HeatmapSectorOut]:
    g = None if grupo == "todos" else grupo
    return await _svc(session).heatmap_sectores(g)


@router.get("/puntos-heatmap", response_model=list[PuntoHeatmapOut])
async def puntos_heatmap(
    session: PropiaSession,
    solo_robos: Annotated[bool, Query()] = False,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
) -> list[PuntoHeatmapOut]:
    """Puntos (lat, lon, peso) para la capa `heatmap` de MapLibre — mancha
    continua tipo pronóstico del clima. `solo_robos=true` filtra a incidentes
    con `es_robo=true` para el heatmap del tab Robo."""
    g = None if grupo == "todos" else grupo
    return await _svc(session).puntos_heatmap(solo_robos=solo_robos, grupo=g, sectorid=sectorid)


@router.get("/top-calles", response_model=list[TramoRankOut])
async def top_calles(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
    limite: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[TramoRankOut]:
    g = None if grupo == "todos" else grupo
    return await _svc(session).top_calles(limite, g, sectorid)


# ---------------- Series temporales ----------------

@router.get("/serie-mensual", response_model=SerieMensualOut)
async def serie_mensual(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
) -> SerieMensualOut:
    g = None if grupo == "todos" else grupo
    return await _svc(session).serie_mensual(g, sectorid)


@router.get("/robos-mensual", response_model=SerieMensualOut)
async def robos_mensual(
    session: PropiaSession,
    anio: Annotated[int | None, Query(ge=2020, le=2100)] = None,
) -> SerieMensualOut:
    return await _svc(session).serie_robos_mensual(anio)


@router.get("/tiempo-resolucion-mensual", response_model=SerieTiempoResolucionOut)
async def tiempo_resolucion_mensual(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
) -> SerieTiempoResolucionOut:
    g = None if grupo == "todos" else grupo
    return await _svc(session).tiempo_resolucion_mensual(g, sectorid)


@router.get("/tipo-atencion-mensual", response_model=SerieStackedOut)
async def tipo_atencion_mensual(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
) -> SerieStackedOut:
    g = None if grupo == "todos" else grupo
    return await _svc(session).tipo_atencion_mensual_stacked(g, sectorid)


# ---------------- Reincidentes ----------------

@router.get("/reincidentes", response_model=list[ReincidenteOut])
async def reincidentes(
    session: PropiaSession,
    meses: Annotated[int, Query(ge=1, le=240)] = 12,
    minimo: Annotated[int, Query(ge=2, le=20)] = 3,
    solo_robo: Annotated[bool, Query()] = False,
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ReincidenteOut]:
    # Para robos, ventana default más corta si viene el flag y no cambiaron los defaults
    if solo_robo and meses == 12 and minimo == 3:
        meses, minimo = 6, 2
    return await _svc(session).reincidentes(meses, minimo, limite, solo_robo)


# ---------------- Sin solución ----------------

@router.get("/sin-solucion", response_model=list[SinSolucionRowOut])
async def sin_solucion(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[SinSolucionRowOut]:
    g = None if grupo == "todos" else grupo
    return await _svc(session).sin_solucion(limite, g, sectorid)


# ---------------- Multi reclamos ----------------

@router.get("/multi-reclamos", response_model=list[MultiReclamoOut])
async def multi_reclamos(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
    minimo: Annotated[int, Query(ge=2, le=10)] = 2,
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[MultiReclamoOut]:
    g = None if grupo == "todos" else grupo
    return await _svc(session).multi_reclamos(minimo, limite, g, sectorid)


# ---------------- Parentesco ----------------

@router.get("/parentesco", response_model=list[ParentescoSliceOut])
async def parentesco(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
) -> list[ParentescoSliceOut]:
    g = None if grupo == "todos" else grupo
    return await _svc(session).parentesco(g, sectorid)


# ---------------- Alertas semáforo ----------------

@router.get("/alertas", response_model=list[AlertaOut])
async def alertas(session: PropiaSession) -> list[AlertaOut]:
    return await _svc(session).alertas()


# ---------------- Tortas ----------------

@router.get("/tipo-grupo-pie", response_model=list[SliceOut])
async def tipo_grupo_pie(
    session: PropiaSession,
    sectorid: Annotated[int | None, Query()] = None,
) -> list[SliceOut]:
    return await _svc(session).tipo_grupo_pie(sectorid)


@router.get("/tipo-atencion-pie", response_model=list[SliceOut])
async def tipo_atencion_pie(
    session: PropiaSession,
    grupo: Annotated[Grupo, Query()] = "todos",
    sectorid: Annotated[int | None, Query()] = None,
) -> list[SliceOut]:
    g = None if grupo == "todos" else grupo
    return await _svc(session).tipo_atencion_pie(g, sectorid)


# ---------------- Robos por distrito ----------------

@router.get("/robos-por-distrito", response_model=list[DistritoRoboOut])
async def robos_por_distrito(
    session: PropiaSession,
    limite: Annotated[int, Query(ge=1, le=20)] = 5,
) -> list[DistritoRoboOut]:
    return await _svc(session).robos_por_distrito(limite)


# ---------------- Predicción (regresión) ----------------

@router.get("/prediccion-sectores", response_model=list[PrediccionSectorOut])
async def prediccion_sectores(
    session: PropiaSession,
    lookback: Annotated[int, Query(ge=3, le=24)] = 6,
) -> list[PrediccionSectorOut]:
    return await _svc(session).prediccion_sectores(lookback)
