"""Caché externa (Redis) de `estado`/`prioridad`/`sector` de `incidente`.

`incidente` no tiene estas columnas (specs/00-arquitectura.md §7) — viven solo aquí,
desechable y reconstruible desde Postgres+`sig` (ver `scripts/rebuild_incidencia_cache.py`).
Nunca es la fuente de verdad: en un *cache miss*, el caller debe recalcular contra las
fuentes reales y repoblar vía `set_resumen`.
"""

from redis.asyncio import Redis

_RESUMEN_KEY = "cache:incidente:{id}:resumen"
_IDX_ESTADO_KEY = "idx:estado:{id}"
_IDX_PRIORIDAD_KEY = "idx:prioridad:{id}"
_IDX_SECTOR_KEY = "idx:sector:{id}"


class Resumen:
    def __init__(self, data: dict[str, str]) -> None:
        self.estado_actual_id: str | None = data.get("estado_actual_id") or None
        self.prioridad_id: str | None = data.get("prioridad_id") or None
        self.sector_id: str | None = data.get("sector_id") or None
        self.sector_nombre: str | None = data.get("sector_nombre") or None
        self.distrito_id: str | None = data.get("distrito_id") or None

    def is_empty(self) -> bool:
        return not any(
            (self.estado_actual_id, self.prioridad_id, self.sector_id, self.distrito_id)
        )


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
    ) -> None:
        """Actualiza el hash de resumen y mantiene los índices invertidos al día.

        Solo toca los campos que vienen distintos de `None` — permite actualizar
        estado sin tener que recalcular sector, y viceversa (ej. spec 05 solo
        actualiza `estado_actual_id` al insertar un evento).
        """
        anterior = await self.get_resumen(incidente_id)

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

        if campos:
            await self._redis.hset(_RESUMEN_KEY.format(id=incidente_id), mapping=campos)

        if estado_actual_id is not None:
            await self._mover_indice(
                _IDX_ESTADO_KEY, incidente_id, anterior.estado_actual_id if anterior else None, estado_actual_id
            )
        if prioridad_id is not None:
            await self._mover_indice(
                _IDX_PRIORIDAD_KEY, incidente_id, anterior.prioridad_id if anterior else None, prioridad_id
            )
        if sector_id is not None:
            await self._mover_indice(
                _IDX_SECTOR_KEY, incidente_id, anterior.sector_id if anterior else None, sector_id
            )

    async def _mover_indice(
        self, key_pattern: str, incidente_id: str, id_anterior: str | None, id_nuevo: str
    ) -> None:
        if id_anterior == id_nuevo:
            return
        if id_anterior is not None:
            await self._redis.srem(key_pattern.format(id=id_anterior), incidente_id)
        await self._redis.sadd(key_pattern.format(id=id_nuevo), incidente_id)

    async def resolver_candidatos(
        self,
        *,
        estado_ids: list[str] | None = None,
        prioridad_ids: list[str] | None = None,
        sector_ids: list[str] | None = None,
    ) -> set[str] | None:
        """`None` significa "sin restricción" (no se pidió ningún filtro resuelto por
        Redis). Si se pidió al menos un filtro, intersecta (AND) los resultados de cada
        dimensión — dentro de cada dimensión los ids son OR (`SUNION`)."""
        grupos: list[set[str]] = []
        for key_pattern, ids in (
            (_IDX_ESTADO_KEY, estado_ids),
            (_IDX_PRIORIDAD_KEY, prioridad_ids),
            (_IDX_SECTOR_KEY, sector_ids),
        ):
            if not ids:
                continue
            keys = [key_pattern.format(id=i) for i in ids]
            grupos.append(await self._redis.sunion(keys) if len(keys) > 1 else await self._redis.smembers(keys[0]))

        if not grupos:
            return None
        candidatos = grupos[0]
        for grupo in grupos[1:]:
            candidatos &= grupo
        return candidatos

    async def sector_incidente_ids(self, sector_id: str) -> set[str]:
        return await self._redis.smembers(_IDX_SECTOR_KEY.format(id=sector_id))
