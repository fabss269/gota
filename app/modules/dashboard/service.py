import uuid
from datetime import date

from app.modules.catalogos.sig_repository import SigCatalogoRepository
from app.modules.dashboard.schemas import (
    DashboardKpisOut,
    DashboardResumenOut,
    PrioridadPorSectorOut,
    TopTipoAtencionOut,
)
from app.modules.incidencias.cache_repository import IncidenciaCacheRepository
from app.modules.incidencias.propia_repository import PropiaIncidenciaRepository

_TOP_TIPOS_LIMITE = 10


class DashboardService:
    def __init__(
        self,
        propia_repo: PropiaIncidenciaRepository,
        cache_repo: IncidenciaCacheRepository,
        sig_catalogo_repo: SigCatalogoRepository,
    ) -> None:
        self._propia = propia_repo
        self._cache = cache_repo
        self._sig_catalogo = sig_catalogo_repo

    async def resumen(self, fecha_desde: date | None, fecha_hasta: date | None) -> DashboardResumenOut:
        por_categoria = await self._propia.resumen_por_categoria(fecha_desde, fecha_hasta)
        top_tipos = await self._propia.top_tipos_atencion(fecha_desde, fecha_hasta, _TOP_TIPOS_LIMITE)
        prioridad_por_sector = await self._prioridad_por_sector()

        return DashboardResumenOut(
            # Los 4 KPIs quedan explícitamente "en espera" (API.md §8, decisión de
            # Edgar 2026-07-21) — el cliente sigue sobre mock mientras tanto, este
            # endpoint no los calcula todavía.
            kpis=DashboardKpisOut(
                incidenciasAbiertasHoy=0,
                incidenciasCriticas=0,
                tiempoPromedioAtencionHoras=0.0,
                cuadrillasActivas=0,
            ),
            porCategoria=por_categoria,
            # "Ilustrativo en ambos lados" (API.md §8) — placeholder explícito, no se
            # calcula contra datos reales en esta fase.
            serieTickets=[],
            topTiposAtencion=[TopTipoAtencionOut(tipo=tipo, cantidad=cantidad) for tipo, cantidad in top_tipos],
            prioridadPorSector=prioridad_por_sector,
        )

    async def _prioridad_por_sector(self) -> list[PrioridadPorSectorOut]:
        sectores = await self._sig_catalogo.listar_sectores(None)
        resultado: list[PrioridadPorSectorOut] = []
        for sector in sectores:
            candidatos = await self._cache.sector_incidente_ids(sector["id"])
            if not candidatos:
                continue
            promedio = await self._propia.antiguedad_promedio_dias([uuid.UUID(c) for c in candidatos])
            if promedio is None:
                continue
            resultado.append(
                PrioridadPorSectorOut(
                    sectorId=sector["id"], nombre=sector["nombre"], antiguedadPromedioDias=round(promedio, 1)
                )
            )
        return resultado
