from collections.abc import Awaitable, Callable

from app.core.exceptions import NoEncontradoError
from app.modules.red.repository import SigRedRepository
from app.modules.red.schemas import ElementoRedOut

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
