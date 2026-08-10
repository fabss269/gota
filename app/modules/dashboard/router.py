from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.modules.catalogos.sig_repository import SigCatalogoRepository
from app.modules.dashboard.schemas import DashboardResumenOut
from app.modules.dashboard.service import DashboardService
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.modules.incidencias.propia_repository import PropiaIncidenciaRepository
from app.shared.deps import CurrentUser, PropiaSession, SigSession

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/resumen", response_model=DashboardResumenOut)
async def resumen(
    session: PropiaSession,
    sig_session: SigSession,
    _usuario: CurrentUser,
    fechaDesde: Annotated[date | None, Query()] = None,
    fechaHasta: Annotated[date | None, Query()] = None,
) -> DashboardResumenOut:
    service = DashboardService(
        PropiaIncidenciaRepository(session),
        CatastroEnrichmentService(sig_session),
        SigCatalogoRepository(sig_session),
    )
    return await service.resumen(fechaDesde, fechaHasta)
