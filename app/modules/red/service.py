from collections.abc import Awaitable, Callable

from app.core.exceptions import NoEncontradoError, ValidacionError
from app.modules.red.repository import SigRedRepository, SigRedWriteRepository
from app.modules.red.schemas import (
    AccesorioClasificacionOut,
    AccesorioTipoOut,
    ElementoRedOut,
    ElementoRedPatchIn,
    MaterialOut,
)

# ── Configuración por tipo de elemento ─────────────────────────────────────────
# Un solo lugar donde se declara qué campos son editables por tipo y a qué columna
# de qué tabla mapean. El resto del service es genérico sobre este diccionario.
#
# `patch_fields`: nombre del campo en ElementoRedPatchIn -> nombre de columna en la
#                 tabla sig correspondiente. Solo estos campos son editables.
# `grupo_material`: valor de sig.materiales.grupo que aplica a este tipo (para el
#                   combo de materiales). None = tipo sin material editable.
# `grupo_accesorio_tipo`: valor de sig.accesoriotipos.grupo aplicable (accesorios).

TIPOS_VALIDOS = {
    "red_potable",
    "valvulas",
    "grifos_contra_incendio",
    "red_primaria_desague",
    "red_secundaria_desague",
    "buzones",
}

# Vocabulario del frontend (elementoDeFeature en MapView.web.tsx).
ELEMENTO_TIPOS_VALIDOS = {
    "tuberia",
    "tramo",
    "buzon",
    "accesorio",
    "cajaagua",
    "cajadesague",
    "manzana",
    "lote",
}

# Whitelist de campos editables por tipo. La clave es el nombre del campo del PATCH
# (ver ElementoRedPatchIn), el valor es el nombre de la columna real en la tabla.
CAMPOS_EDITABLES_POR_TIPO: dict[str, dict[str, str]] = {
    "tuberia": {
        "materialId": "materialid",
        "diametroPulgadas": "diametro",
        "distancia": "distancia",
    },
    "tramo": {
        "primaria": "primaria",
        "materialId": "materialid",
        "pendiente": "pendiente",
        "distancia": "distancia",
    },
    "buzon": {
        "tapa": "tapa",
        "fondo": "fondo",
    },
    "accesorio": {
        "accesorioTipoId": "accesoriotipoid",
        "profundidad": "profundidad",
        "diametroPulgadas": "diametro",
        "accesorioClasificacionId": "accesorioclasificacionid",
    },
    "cajaagua": {
        "cota": "cota",
    },
    "cajadesague": {
        "cota": "cota",
    },
    # manzana/lote no tienen edición inline por ahora (solo lectura).
}

# Grupo de sig.materiales para el combo cuando el usuario edita el material.
GRUPO_MATERIAL_POR_TIPO: dict[str, str] = {
    "tuberia": "AGUA POTABLE",
    "tramo": "ALCANTARILLADO",
}

# Grupo de sig.accesoriotipos para el combo (solo aplica a accesorio).
GRUPO_ACCESORIO_TIPO_POR_ELEMENTO: dict[str, str | None] = {
    "accesorio": None,  # sin filtrar: la BD no distingue grupo útil para accesorios
}


class RedService:
    def __init__(self, repository: SigRedRepository) -> None:
        self._repo = repository
        self._handlers: dict[str, Callable[[str | None, str | None], Awaitable[dict]]] = {
            "red_potable": self._repo.red_potable,
            "red_primaria_desague": lambda d, s: self._repo.red_desague(True, d, s),
            "red_secundaria_desague": lambda d, s: self._repo.red_desague(False, d, s),
            "buzones": self._repo.buzones,
            "valvulas": lambda d, s: self._repo.accesorios("%valvula%", d, s),
            "grifos_contra_incendio": lambda d, s: self._repo.accesorios("%grifo%", d, s),
        }
        self._elemento_handlers: dict[str, Callable[[int], Awaitable[dict | None]]] = {
            "tuberia": self._repo.elemento_tuberia,
            "tramo": self._repo.elemento_tramo,
            "buzon": self._repo.elemento_buzon,
            "accesorio": self._repo.elemento_accesorio,
            "cajaagua": self._repo.elemento_cajaagua,
            "cajadesague": self._repo.elemento_cajadesague,
            "manzana": self._repo.elemento_manzana,
            "lote": self._repo.elemento_lote,
        }

    async def capas(
        self, tipos: list[str], distrito_id: str | None, sector_id: str | None
    ) -> dict[str, dict]:
        resultado: dict[str, dict] = {}
        for tipo in tipos:
            handler = self._handlers.get(tipo)
            if handler is None:
                continue
            resultado[tipo] = await handler(distrito_id, sector_id)
        return resultado

    async def elemento(self, tipo: str, elemento_id: int) -> ElementoRedOut:
        fila = await self._elemento_handlers[tipo](elemento_id)
        if fila is None:
            raise NoEncontradoError(f"{tipo} {elemento_id} no encontrado")
        return ElementoRedOut(tipo=tipo, **fila)


class RedEdicionService:
    """Escritura sobre sig.* (excepción explícita al read-only, ver
    app/db/sig.py:get_sig_write_session)."""

    def __init__(self, repository: SigRedWriteRepository) -> None:
        self._repo = repository

    async def actualizar(self, tipo: str, elemento_id: int, patch: ElementoRedPatchIn) -> None:
        editables = CAMPOS_EDITABLES_POR_TIPO.get(tipo)
        if editables is None:
            raise ValidacionError(
                f"tipo no editable: {tipo}",
                campos={
                    "tipo": f"valores válidos: {', '.join(sorted(CAMPOS_EDITABLES_POR_TIPO))}"
                },
            )

        # Mapear campos del PATCH a columnas de la tabla, validando la whitelist.
        cambios: dict = {}
        rechazados: list[str] = []
        for campo_patch, valor in patch.model_dump(exclude_none=True).items():
            columna = editables.get(campo_patch)
            if columna is None:
                rechazados.append(campo_patch)
                continue
            cambios[columna] = valor

        if rechazados:
            raise ValidacionError(
                f"campo(s) no editable(s) para '{tipo}': {', '.join(rechazados)}",
                campos={
                    campo: f"editables para {tipo}: {', '.join(sorted(editables))}"
                    for campo in rechazados
                },
            )

        if not cambios:
            raise ValidacionError(
                "no hay nada que actualizar",
                campos={"body": "envíe al menos un campo válido para este tipo"},
            )

        # Delegar al método correcto del write repository según tipo.
        actualizadores: dict[str, Callable[[int, dict], Awaitable[bool]]] = {
            "tuberia": self._repo.actualizar_tuberia,
            "tramo": self._repo.actualizar_tramo,
            "buzon": self._repo.actualizar_buzon,
            "accesorio": self._repo.actualizar_accesorio,
            "cajaagua": self._repo.actualizar_cajaagua,
            "cajadesague": self._repo.actualizar_cajadesague,
        }
        actualizado = await actualizadores[tipo](elemento_id, cambios)
        if not actualizado:
            raise NoEncontradoError(f"{tipo} {elemento_id} no encontrado")

    async def listar_materiales(self, grupo: str | None) -> list[MaterialOut]:
        filas = await self._repo.listar_materiales(grupo)
        return [MaterialOut(**fila) for fila in filas]

    async def listar_materiales_por_tipo(self, tipo: str) -> list[MaterialOut]:
        """Compat con el endpoint viejo /materiales/{tipo}: resuelve el grupo desde
        el tipo y delega."""
        grupo = GRUPO_MATERIAL_POR_TIPO.get(tipo)
        if grupo is None:
            raise ValidacionError(
                f"tipo sin catálogo de materiales: {tipo}",
                campos={"tipo": f"valores válidos: {', '.join(sorted(GRUPO_MATERIAL_POR_TIPO))}"},
            )
        return await self.listar_materiales(grupo)

    async def listar_accesorio_tipos(self, grupo: str | None) -> list[AccesorioTipoOut]:
        filas = await self._repo.listar_accesorio_tipos(grupo)
        return [AccesorioTipoOut(**fila) for fila in filas]

    async def listar_accesorio_clasificaciones(self) -> list[AccesorioClasificacionOut]:
        filas = await self._repo.listar_accesorio_clasificaciones()
        return [AccesorioClasificacionOut(**fila) for fila in filas]
