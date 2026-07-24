from typing import Annotated

from fastapi import APIRouter, Query

from app.core.exceptions import ValidacionError
from app.modules.red.repository import SigRedRepository
from app.modules.red.service import TIPOS_VALIDOS, RedService
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
