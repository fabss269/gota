from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.core.exceptions import ValidacionError
from app.modules.red.repository import SigRedRepository, SigRedWriteRepository
from app.modules.red.schemas import (
    AccesorioClasificacionOut,
    AccesorioTipoOut,
    ElementoRedOut,
    ElementoRedPatchIn,
    LongitudMaterialOut,
    MaterialOut,
)
from app.modules.red.service import (
    ELEMENTO_TIPOS_VALIDOS,
    GRUPO_MATERIAL_POR_TIPO,
    TIPOS_VALIDOS,
    RedEdicionService,
    RedService,
)
from app.shared.deps import CurrentUser, SigSession, SigWriteSession

router = APIRouter(prefix="/red", tags=["red"])


@router.get("/capas", response_model=dict[str, dict])
async def listar_capas(
    sig_session: SigSession,
    _usuario: CurrentUser,
    tipos: Annotated[str, Query()],
    distritoId: Annotated[str | None, Query()] = None,
    sectorId: Annotated[str | None, Query()] = None,
) -> dict[str, dict]:
    tipos_pedidos = tipos.split(",")
    desconocidos = [t for t in tipos_pedidos if t not in TIPOS_VALIDOS]
    if desconocidos:
        raise ValidacionError(
            f"tipos desconocidos: {', '.join(desconocidos)}",
            campos={"tipos": f"valores válidos: {', '.join(sorted(TIPOS_VALIDOS))}"},
        )

    service = RedService(SigRedRepository(sig_session))
    return await service.capas(tipos_pedidos, distritoId, sectorId)


@router.get("/elemento/{tipo}/{elemento_id}", response_model=ElementoRedOut)
async def obtener_elemento(
    sig_session: SigSession,
    _usuario: CurrentUser,
    tipo: Annotated[str, Path()],
    elemento_id: Annotated[int, Path()],
) -> ElementoRedOut:
    if tipo not in ELEMENTO_TIPOS_VALIDOS:
        raise ValidacionError(
            f"tipo desconocido: {tipo}",
            campos={"tipo": f"valores válidos: {', '.join(sorted(ELEMENTO_TIPOS_VALIDOS))}"},
        )

    service = RedService(SigRedRepository(sig_session))
    return await service.elemento(tipo, elemento_id)


@router.patch("/elemento/{tipo}/{elemento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def actualizar_elemento(
    sig_write_session: SigWriteSession,
    _usuario: CurrentUser,
    tipo: Annotated[str, Path()],
    elemento_id: Annotated[int, Path()],
    patch: ElementoRedPatchIn,
) -> None:
    """Edición inline desde el panel de detalle del mapa. Escribe directo sobre
    `sig` (excepción explícita al read-only, ver app/db/sig.py:get_sig_write_session)."""
    service = RedEdicionService(SigRedWriteRepository(sig_write_session))
    await service.actualizar(tipo, elemento_id, patch)


# ── Catálogos para poblar los combos editables ─────────────────────────────────


@router.get("/materiales", response_model=list[MaterialOut])
async def listar_materiales(
    sig_session: SigSession,
    _usuario: CurrentUser,
    grupo: Annotated[str | None, Query()] = None,
) -> list[MaterialOut]:
    """Filtra por `grupo` (columna en sig.materiales: 'AGUA POTABLE' o 'ALCANTARILLADO').
    Sin `grupo` devuelve todos los materiales activos."""
    service = RedEdicionService(SigRedWriteRepository(sig_session))
    return await service.listar_materiales(grupo)


@router.get("/materiales/{tipo}", response_model=list[MaterialOut])
async def listar_materiales_por_tipo(
    sig_session: SigSession,
    _usuario: CurrentUser,
    tipo: Annotated[str, Path()],
) -> list[MaterialOut]:
    """Compat: mismo resultado que /materiales?grupo=X, pero resolviendo el grupo
    desde el tipo del elemento (tuberia -> AGUA POTABLE, tramo -> ALCANTARILLADO)."""
    if tipo not in GRUPO_MATERIAL_POR_TIPO:
        raise ValidacionError(
            f"tipo sin catálogo de materiales: {tipo}",
            campos={"tipo": f"valores válidos: {', '.join(sorted(GRUPO_MATERIAL_POR_TIPO))}"},
        )
    service = RedEdicionService(SigRedWriteRepository(sig_session))
    return await service.listar_materiales_por_tipo(tipo)


@router.get("/accesorio-tipos", response_model=list[AccesorioTipoOut])
async def listar_accesorio_tipos(
    sig_session: SigSession,
    _usuario: CurrentUser,
    grupo: Annotated[str | None, Query()] = None,
) -> list[AccesorioTipoOut]:
    """Catálogo de sig.accesoriotipos. Sin `grupo` devuelve todos."""
    service = RedEdicionService(SigRedWriteRepository(sig_session))
    return await service.listar_accesorio_tipos(grupo)


@router.get("/accesorio-clasificaciones", response_model=list[AccesorioClasificacionOut])
async def listar_accesorio_clasificaciones(
    sig_session: SigSession,
    _usuario: CurrentUser,
) -> list[AccesorioClasificacionOut]:
    """Catálogo de sig.accesorioclasificacion."""
    service = RedEdicionService(SigRedWriteRepository(sig_session))
    return await service.listar_accesorio_clasificaciones()


@router.get("/longitud-por-material", response_model=list[LongitudMaterialOut])
async def longitud_por_material(
    sig_session: SigSession,
    _usuario: CurrentUser,
    grupo: Annotated[str, Query()],
    sector_id: Annotated[str | None, Query(alias="sectorId")] = None,
    distrito_id: Annotated[str | None, Query(alias="distritoId")] = None,
    provincia_id: Annotated[str | None, Query(alias="provinciaId")] = None,
    diametro: Annotated[float | None, Query()] = None,
) -> list[LongitudMaterialOut]:
    """Metros de tubería por material. `grupo`: agua|alcantarillado. `diametro`
    solo aplica a agua (sig.alcantarillado no tiene esa columna)."""
    service = RedService(SigRedRepository(sig_session))
    return await service.longitud_por_material(grupo, sector_id, distrito_id, provincia_id, diametro)
