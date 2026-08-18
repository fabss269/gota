from app.db.models_propia import Incidente
from app.modules.incidencias.cache_repository import IncidenciaCacheRepository
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.modules.usuarios.repository import UsuarioRepository
from app.modules.usuarios.schemas import UsuarioOut


class UsuarioService:
    def __init__(
        self,
        repository: UsuarioRepository,
        cache_repo: IncidenciaCacheRepository,
        catastro_svc: CatastroEnrichmentService,
    ) -> None:
        self._repo = repository
        self._cache = cache_repo
        self._catastro = catastro_svc

    async def listar(self, roles: list[str] | None, sector_id: str | None) -> list[UsuarioOut]:
        usuarios = await self._repo.listar(roles)
        if not usuarios:
            return []

        usuario_ids = [u.usuario_id for u in usuarios]
        ultimo_incidente = await self._repo.mapa_ultimo_incidente(usuario_ids)
        incidentes = await self._repo.get_incidentes_por_ids(list(set(ultimo_incidente.values())))

        resultado: list[UsuarioOut] = []
        for usuario in usuarios:
            sector_id_usuario: str | None = None
            sector_nombre: str | None = None
            incidente = incidentes.get(ultimo_incidente.get(usuario.usuario_id))
            if incidente is not None:
                sector_id_usuario, sector_nombre = await self._resolver_sector(incidente)

            # `sectorId` es "la operación inversa" (specs/06): en vez de leer un índice
            # que puede estar frío, se resuelve el sector real de cada candidato (lista
            # ya acotada por rol, chica) y se compara en Python — correcto incluso si
            # `idx:sector:*` todavía no tiene ese incidente cacheado.
            if sector_id is not None and sector_id_usuario != sector_id:
                continue

            resultado.append(
                UsuarioOut(
                    id=str(usuario.usuario_id),
                    nombre=f"{usuario.nombres} {usuario.apellidos}",
                    rol=usuario.rol.codigo,
                    sector=sector_nombre,
                )
            )
        return resultado

    async def _resolver_sector(self, incidente: Incidente) -> tuple[str | None, str | None]:
        resumen = await self._cache.get_resumen(str(incidente.incidente_id))
        if resumen and resumen.sector_id:
            return resumen.sector_id, resumen.sector_nombre

        categoria = incidente.tipo_atencion.tipo_grupo.codigo
        predio = await self._catastro.resolver_predio(incidente.suministro_codigo, categoria)
        if predio is None:
            return None, None

        await self._cache.set_resumen(
            str(incidente.incidente_id),
            sector_id=str(predio.sector_id),
            sector_nombre=predio.sector_nombre,
            distrito_id=str(predio.distrito_id),
        )
        return str(predio.sector_id), predio.sector_nombre
