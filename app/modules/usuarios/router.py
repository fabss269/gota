from typing import Annotated

from fastapi import APIRouter, Query

from app.modules.incidencias.cache_repository import IncidenciaCacheRepository
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.usuarios.schemas import UsuarioOut
from app.modules.usuarios.service import UsuarioService
from app.shared.deps import CurrentUser, PropiaSession, RedisDep, SigSession

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=list[UsuarioOut])
async def listar(
    session: PropiaSession,
    sig_session: SigSession,
    redis: RedisDep,
    _usuario: CurrentUser,
    rol: Annotated[str | None, Query()] = None,
    sectorId: Annotated[str | None, Query()] = None,
) -> list[UsuarioOut]:
    service = UsuarioService(
        UsuarioRepository(session),
        IncidenciaCacheRepository(redis),
        CatastroEnrichmentService(sig_session),
    )
    roles = rol.split(",") if rol else None
    return await service.listar(roles, sectorId)
