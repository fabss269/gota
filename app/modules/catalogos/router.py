from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.sig import get_sig_session
from app.modules.catalogos.propia_repository import PropiaCatalogoRepository
from app.modules.catalogos.schemas import (
    DistritoOut,
    ProvinciaOut,
    SectorOut,
    SuministroOut,
    TipoAtencionOut,
    TipoGrupoOut,
)
from app.modules.catalogos.service import PropiaCatalogoService, SigCatalogoService
from app.modules.catalogos.sig_repository import SigCatalogoRepository
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.shared.deps import PropiaSession

router = APIRouter(prefix="/catalogos", tags=["catalogos"])

SigSession = Annotated[AsyncSession, Depends(get_sig_session)]

# Catálogos que casi no cambian (API.md lo indica explícitamente) — Cache-Control largo
# en vez de una caché externa, no vale la pena la complejidad de Redis para esto.
_CACHE_CONTROL = "public, max-age=3600"


@router.get("/provincias", response_model=list[ProvinciaOut])
async def listar_provincias(response: Response, sig_session: SigSession) -> list[ProvinciaOut]:
    response.headers["Cache-Control"] = _CACHE_CONTROL
    service = SigCatalogoService(SigCatalogoRepository(sig_session))
    return await service.listar_provincias()


@router.get("/distritos", response_model=list[DistritoOut])
async def listar_distritos(response: Response, sig_session: SigSession) -> list[DistritoOut]:
    response.headers["Cache-Control"] = _CACHE_CONTROL
    service = SigCatalogoService(SigCatalogoRepository(sig_session))
    return await service.listar_distritos()


@router.get("/sectores", response_model=list[SectorOut])
async def listar_sectores(
    response: Response,
    sig_session: SigSession,
    distritoId: Annotated[str | None, Query()] = None,
) -> list[SectorOut]:
    response.headers["Cache-Control"] = _CACHE_CONTROL
    service = SigCatalogoService(SigCatalogoRepository(sig_session))
    return await service.listar_sectores(distritoId)


@router.get("/suministro/{codigo}", response_model=SuministroOut)
async def buscar_suministro(codigo: str, sig_session: SigSession) -> SuministroOut:
    # Reutiliza el mismo cruce ya probado que usa la creación/detalle de incidencias
    # (`inscripcion` en sig.cajaagua, excluyendo el centinela '00000000') — no hay
    # necesidad de una query nueva para esto.
    service = CatastroEnrichmentService(sig_session)
    predio = await service.resolver_predio(codigo, "agua")
    if predio is None:
        raise HTTPException(status_code=404, detail="No se encontró una caja de agua con ese suministro")
    return SuministroOut(
        lat=predio.lat, lon=predio.lon, sectorId=predio.sector_id, sectorNombre=predio.sector_nombre
    )


@router.get("/tipos-grupo", response_model=list[TipoGrupoOut])
async def listar_tipos_grupo(
    response: Response, propia_session: PropiaSession
) -> list[TipoGrupoOut]:
    response.headers["Cache-Control"] = _CACHE_CONTROL
    service = PropiaCatalogoService(PropiaCatalogoRepository(propia_session))
    return await service.listar_tipos_grupo()


@router.get("/tipos-atencion", response_model=list[TipoAtencionOut])
async def listar_tipos_atencion(
    response: Response, propia_session: PropiaSession
) -> list[TipoAtencionOut]:
    response.headers["Cache-Control"] = _CACHE_CONTROL
    service = PropiaCatalogoService(PropiaCatalogoRepository(propia_session))
    return await service.listar_tipos_atencion()


@router.get("/estados", response_model=list[str])
async def listar_estados(response: Response, propia_session: PropiaSession) -> list[str]:
    response.headers["Cache-Control"] = _CACHE_CONTROL
    service = PropiaCatalogoService(PropiaCatalogoRepository(propia_session))
    return await service.listar_estados()
