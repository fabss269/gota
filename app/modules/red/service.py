from collections.abc import Awaitable, Callable

from app.core.exceptions import NoEncontradoError, ValidacionError
from app.modules.red.repository import SigRedRepository, SigRedWriteRepository
from app.modules.red.schemas import ElementoRedOut, ElementoRedPatchIn, MaterialOut

# Tipos de elemento editables (PATCH /red/elemento/{tipo}/{id}) y a qué grupo de
# sig.materiales corresponde cada uno — el resto de tipos (buzon/accesorio/
# cajaagua/cajadesague/manzana/lote) no tiene edición inline pedida todavía.
ELEMENTO_TIPO_A_GRUPO_MATERIAL = {
    "tuberia": "AGUA POTABLE",
    "tramo": "ALCANTARILLADO",
}

TIPOS_VALIDOS = {
    "red_potable",
    "valvulas",
    "grifos_contra_incendio",
    "red_primaria_desague",
    "red_secundaria_desague",
    "buzones",
}

# Mismo vocabulario que `elementoDeFeature` en MapView.web.tsx (frontend) — el tipo
# que identifica de qué tabla de `sig` viene el elemento clickeado en el mapa.
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
    """Escritura sobre sig.agua/sig.alcantarillado (ver
    app/db/sig.py:get_sig_write_session) — separado de RedService (solo lectura)
    porque usa una sesión distinta, sin el guard de READ ONLY."""

    def __init__(self, repository: SigRedWriteRepository) -> None:
        self._repo = repository

    async def actualizar(self, tipo: str, elemento_id: int, patch: ElementoRedPatchIn) -> None:
        if tipo not in ELEMENTO_TIPO_A_GRUPO_MATERIAL:
            raise ValidacionError(
                f"tipo no editable: {tipo}",
                campos={"tipo": f"valores válidos: {', '.join(sorted(ELEMENTO_TIPO_A_GRUPO_MATERIAL))}"},
            )
        if tipo == "tramo" and patch.diametroPulgadas is not None:
            # sig.alcantarillado no tiene columna de diámetro — gap real del
            # schema, no un olvido (ver memoria del proyecto).
            raise ValidacionError(
                "un tramo de alcantarillado no tiene diámetro editable",
                campos={"diametroPulgadas": "sig.alcantarillado no tiene esa columna"},
            )

        if tipo == "tuberia":
            actualizado = await self._repo.actualizar_tuberia(
                elemento_id, patch.diametroPulgadas, patch.materialId
            )
        else:
            if patch.materialId is None:
                raise ValidacionError(
                    "no hay nada que actualizar", campos={"materialId": "requerido para tramo"}
                )
            actualizado = await self._repo.actualizar_tramo(elemento_id, patch.materialId)

        if not actualizado:
            raise NoEncontradoError(f"{tipo} {elemento_id} no encontrado")

    async def listar_materiales(self, tipo: str) -> list[MaterialOut]:
        grupo = ELEMENTO_TIPO_A_GRUPO_MATERIAL.get(tipo)
        if grupo is None:
            raise ValidacionError(
                f"tipo sin catálogo de materiales: {tipo}",
                campos={"tipo": f"valores válidos: {', '.join(sorted(ELEMENTO_TIPO_A_GRUPO_MATERIAL))}"},
            )
        filas = await self._repo.listar_materiales(grupo)
        return [MaterialOut(**fila) for fila in filas]
