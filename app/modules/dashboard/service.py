from datetime import UTC, date, datetime

from app.modules.catalogos.sig_repository import SigCatalogoRepository
from app.modules.dashboard.schemas import (
    DashboardKpisOut,
    DashboardResumenOut,
    PrioridadPorSectorOut,
    TopTipoAtencionOut,
)
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.modules.incidencias.propia_repository import PropiaIncidenciaRepository

_TOP_TIPOS_LIMITE = 10


class DashboardService:
    def __init__(
        self,
        propia_repo: PropiaIncidenciaRepository,
        catastro_svc: CatastroEnrichmentService,
        sig_catalogo_repo: SigCatalogoRepository,
    ) -> None:
        self._propia = propia_repo
        self._catastro = catastro_svc
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
        """Antigüedad promedio de incidentes por sector. Antes resolvía los
        incidentes de cada sector con un índice invertido en Redis (`idx:sector:*`),
        que solo se llenaba leyendo incidentes uno por uno — con Redis vacío este
        endpoint devolvía la lista vacía para TODOS los sectores. Ahora resuelve
        sector por `suministro_codigo` directo contra `sig` (decisión de Edgar
        2026-08-10, mismo criterio que `IncidenciaService.listar`): un query a
        `sig` trae todo el mapa suministro->sector de una, y se agrupa en Python
        contra los incidentes reales de Postgres — sin Redis de por medio."""
        sectores = await self._sig_catalogo.listar_sectores(None)
        sector_por_suministro = await self._catastro.mapa_suministro_a_sector()
        suministros_y_fechas = await self._propia.listar_suministro_y_fecha()

        ahora = datetime.now(UTC).replace(tzinfo=None)
        edades_por_sector: dict[int, list[float]] = {}
        for suministro_codigo, creado_en in suministros_y_fechas:
            sector_id = sector_por_suministro.get(suministro_codigo)
            if sector_id is None:
                continue
            edades_por_sector.setdefault(sector_id, []).append((ahora - creado_en).total_seconds() / 86400)

        resultado: list[PrioridadPorSectorOut] = []
        for sector in sectores:
            edades = edades_por_sector.get(int(sector["id"]))
            if not edades:
                continue
            resultado.append(
                PrioridadPorSectorOut(
                    sectorId=sector["id"],
                    nombre=sector["nombre"],
                    antiguedadPromedioDias=round(sum(edades) / len(edades), 1),
                )
            )
        return resultado
