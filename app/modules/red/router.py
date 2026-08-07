from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.core.exceptions import ValidacionError
from app.modules.red.repository import SigRedRepository
from app.modules.red.schemas import ElementoRedOut
from app.modules.red.service import ELEMENTO_TIPOS_VALIDOS, TIPOS_VALIDOS, RedService
from app.shared.deps import CurrentUser, SigSession

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
