"""Caché externa (Redis) de `estado`/`prioridad`/`sector` de `incidente` — solo
para armar rápido los campos derivados de `GET /incidencias`, nunca para filtrar.

`incidente` no tiene estas columnas (specs/00-arquitectura.md §7) — viven solo aquí,
desechable y reconstruible desde Postgres+`sig`. Es una caché de lectura individual
pura (get/set por id): decisión de Edgar 2026-08-10 de sacar los índices invertidos
(`idx:estado:*`/`idx:sector:*`/`idx:prioridad:*`) que existían antes — esos requerían
que cada incidente hubiera sido leído al menos una vez (o un rebuild manual) para que
el filtrado funcionara; si Redis estaba vacío (recién reiniciado, o después de un
restore de BD), filtrar por estado/sector devolvía 0 resultados aunque la BD tuviera
todo bien. Ahora `estado`/`sector` se filtran directo contra Postgres/`sig`
(`propia_repository.py`/`catastro_enrichment.py`), sin pasar por Redis — esta caché
solo evita recalcular por incidente en cada respuesta, nunca decide qué incidente
entra o no en un listado."""

from redis.asyncio import Redis

_RESUMEN_KEY = "cache:incidente:{id}:resumen"


class Resumen:
    def __init__(self, data: dict[str, str]) -> None:
        self.estado_actual_id: str | None = data.get("estado_actual_id") or None
        self.prioridad_id: str | None = data.get("prioridad_id") or None
        self.sector_id: str | None = data.get("sector_id") or None
        self.sector_nombre: str | None = data.get("sector_nombre") or None
        self.distrito_id: str | None = data.get("distrito_id") or None
        # "1" si ya se intentó resolver el predio contra `sig` y no hubo match
        # (suministro_codigo sin fila en cajaagua/cajadesague — bug real encontrado
        # en vivo 2026-08-10: ~22% de los incidentes recientes caen acá, y sin este
        # sentinel cada request volvía a golpear `sig` para ellos, siempre, porque
        # `sector_nombre is None` nunca deja de ser cierto). Con el sentinel, un
        # cache-miss real (nunca se intentó) se distingue de un intento fallido.
        self.sin_catastro: bool = data.get("sin_catastro") == "1"

    def is_empty(self) -> bool:
        return not any(
            (self.estado_actual_id, self.prioridad_id, self.sector_id, self.distrito_id, self.sin_catastro)
        )

    @property
    def sector_resuelto(self) -> bool:
        """True si ya no hace falta volver a intentar `resolver_predio` — o porque
        ya se resolvió, o porque ya se intentó y no hay match en `sig`."""
        return self.sector_nombre is not None or self.sin_catastro


class IncidenciaCacheRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def get_resumen(self, incidente_id: str) -> Resumen | None:
        data = await self._redis.hgetall(_RESUMEN_KEY.format(id=incidente_id))
        if not data:
            return None
        return Resumen(data)

    async def mget_resumenes(self, incidente_ids: list[str]) -> dict[str, Resumen]:
        if not incidente_ids:
            return {}
        async with self._redis.pipeline(transaction=False) as pipe:
            for incidente_id in incidente_ids:
                pipe.hgetall(_RESUMEN_KEY.format(id=incidente_id))
            resultados = await pipe.execute()
        return {
            incidente_id: Resumen(data)
            for incidente_id, data in zip(incidente_ids, resultados, strict=True)
            if data
        }

    async def set_resumen(
        self,
        incidente_id: str,
        *,
        estado_actual_id: str | None = None,
        prioridad_id: str | None = None,
        sector_id: str | None = None,
        sector_nombre: str | None = None,
        distrito_id: str | None = None,
        sin_catastro: bool = False,
    ) -> None:
        """Actualiza el hash de resumen — solo toca los campos que vienen distintos
        de `None`, permite actualizar estado sin tener que recalcular sector, y
        viceversa (ej. spec 05 solo actualiza `estado_actual_id` al insertar un
        evento). Sin índices invertidos que mantener (ver docstring del módulo)."""
        campos = self._campos(
            estado_actual_id=estado_actual_id,
            prioridad_id=prioridad_id,
            sector_id=sector_id,
            sector_nombre=sector_nombre,
            distrito_id=distrito_id,
            sin_catastro=sin_catastro,
        )
        if campos:
            await self._redis.hset(_RESUMEN_KEY.format(id=incidente_id), mapping=campos)

    async def set_resumenes(self, entradas: dict[str, dict[str, str | bool | None]]) -> None:
        """Igual que `set_resumen` pero para varios incidentes de una — un solo
        pipeline en vez de N `HSET` secuenciales (usado por `IncidenciaService.
        listar`, ver bug de N+1 encontrado en vivo 2026-08-10: listar 100
        incidencias hacía ~100+ round-trips secuenciales a Redis)."""
        if not entradas:
            return
        async with self._redis.pipeline(transaction=False) as pipe:
            for incidente_id, kwargs in entradas.items():
                campos = self._campos(**kwargs)
                if campos:
                    pipe.hset(_RESUMEN_KEY.format(id=incidente_id), mapping=campos)
            await pipe.execute()

    @staticmethod
    def _campos(
        *,
        estado_actual_id: str | None = None,
        prioridad_id: str | None = None,
        sector_id: str | None = None,
        sector_nombre: str | None = None,
        distrito_id: str | None = None,
        sin_catastro: bool = False,
    ) -> dict[str, str]:
        campos: dict[str, str] = {}
        if estado_actual_id is not None:
            campos["estado_actual_id"] = estado_actual_id
        if prioridad_id is not None:
            campos["prioridad_id"] = prioridad_id
        if sector_id is not None:
            campos["sector_id"] = sector_id
        if sector_nombre is not None:
            campos["sector_nombre"] = sector_nombre
        if distrito_id is not None:
            campos["distrito_id"] = distrito_id
        if sin_catastro:
            campos["sin_catastro"] = "1"
        return campos
