from collections.abc import Awaitable, Callable

from app.modules.red.repository import SigRedRepository

TIPOS_VALIDOS = {
    "red_potable",
    "valvulas",
    "grifos_contra_incendio",
    "red_primaria_desague",
    "red_secundaria_desague",
    "buzones",
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
