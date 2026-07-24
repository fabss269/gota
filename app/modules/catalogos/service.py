from app.modules.catalogos.propia_repository import PropiaCatalogoRepository
from app.modules.catalogos.schemas import DistritoOut, SectorOut, TipoAtencionOut
from app.modules.catalogos.sig_repository import SigCatalogoRepository


class SigCatalogoService:
    """Distritos y sectores — viven en `sig`, no en la BD propia."""

    def __init__(self, repository: SigCatalogoRepository) -> None:
        self._repository = repository

    async def listar_distritos(self) -> list[DistritoOut]:
        filas = await self._repository.listar_distritos()
        return [DistritoOut(**fila) for fila in filas]

    async def listar_sectores(self, distrito_id: str | None) -> list[SectorOut]:
        filas = await self._repository.listar_sectores(distrito_id)
        return [SectorOut(**fila) for fila in filas]


class PropiaCatalogoService:
    """Tipos de atención y estados — catálogos de negocio en la BD propia."""

    def __init__(self, repository: PropiaCatalogoRepository) -> None:
        self._repository = repository

    async def listar_tipos_atencion(self) -> list[TipoAtencionOut]:
        tipos = await self._repository.listar_tipos_atencion()
        return [
            TipoAtencionOut(id=tipo.codigo, nombre=tipo.nombre, categoria=tipo.tipo_grupo.codigo)
            for tipo in tipos
        ]

    async def listar_estados(self) -> list[str]:
        estados = await self._repository.listar_estados()
        return [estado.codigo for estado in estados]
