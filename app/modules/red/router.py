from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.core.exceptions import ValidacionError
from app.modules.red.repository import SigRedRepository, SigRedWriteRepository
from app.modules.red.schemas import ElementoRedOut, ElementoRedPatchIn, MaterialOut
from app.modules.red.service import (
    ELEMENTO_TIPO_A_GRUPO_MATERIAL,
    ELEMENTO_TIPOS_VALIDOS,
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
    """Edición inline (estilo Jira) de diámetro/material — escribe directo sobre
    `sig`, ver app/db/sig.py:get_sig_write_session (excepción explícita al
    read-only, decisión de Edgar 2026-08-07: no sobrevive a un restore futuro de
    un backup de Fabiana, se evaluó y se aceptó ese riesgo)."""
    service = RedEdicionService(SigRedWriteRepository(sig_write_session))
    await service.actualizar(tipo, elemento_id, patch)


@router.get("/materiales/{tipo}", response_model=list[MaterialOut])
async def listar_materiales(
    sig_session: SigSession,
    _usuario: CurrentUser,
    tipo: Annotated[str, Path()],
) -> list[MaterialOut]:
    if tipo not in ELEMENTO_TIPO_A_GRUPO_MATERIAL:
        raise ValidacionError(
            f"tipo sin catálogo de materiales: {tipo}",
            campos={"tipo": f"valores válidos: {', '.join(sorted(ELEMENTO_TIPO_A_GRUPO_MATERIAL))}"},
        )
    # Solo lectura (catálogo) — se sirve de la sesión read-only normal, no de la
    # de escritura, aunque comparta clase de repositorio con actualizar_elemento.
    service = RedEdicionService(SigRedWriteRepository(sig_session))
    return await service.listar_materiales(tipo)
