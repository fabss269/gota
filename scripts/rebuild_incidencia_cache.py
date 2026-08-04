"""Reconstruye la caché Redis de `estado`/`prioridad`/`sector` de `incidente`
(specs/00-arquitectura.md §7).

Es una caché externa, desechable por definición: si se pierde o se vacía, se
reconstruye por completo desde Postgres+`sig` sin perder información, porque nunca fue
la única fuente de esos datos.

`poblar_cache_incidentes` es la pieza reutilizable — la usa tanto este script (CLI,
`incidente_ids=None` = todos) como `app/modules/incidencias/dana_ingest.py` (solo los
incidentes tocados por el último pull, no una reconstrucción completa en cada corrida
del scheduler). Bug real encontrado 2026-08-04: el ingest de DANA escribe directo a
Postgres via `tickets_loader` (mismo camino que la carga histórica original, que
siempre asumía que se corría este script aparte después) — sin esto, los incidentes
nuevos quedan invisibles en `GET /incidencias` porque el filtro de prioridad/estado/
sector resuelve candidatos desde los índices invertidos de Redis, no desde Postgres.

Uso: .venv/bin/python -m scripts.rebuild_incidencia_cache
"""

import asyncio
import uuid

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import propia_connect_args, settings
from app.db.models_propia import Incidente
from app.modules.incidencias.cache_repository import IncidenciaCacheRepository
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.modules.incidencias.propia_repository import PropiaIncidenciaRepository

_KEY_PATTERNS = ("cache:incidente:*:resumen", "idx:estado:*", "idx:prioridad:*", "idx:sector:*")


async def _limpiar_claves(redis: Redis) -> int:
    borradas = 0
    for patron in _KEY_PATTERNS:
        async for clave in redis.scan_iter(match=patron, count=500):
            await redis.delete(clave)
            borradas += 1
    return borradas


async def poblar_cache_incidentes(
    *,
    propia_session: AsyncSession,
    sig_session: AsyncSession,
    redis: Redis,
    incidente_ids: list[uuid.UUID] | None = None,
    verbose: bool = False,
) -> int:
    """Calcula y escribe estado/prioridad/sector en Redis para los incidentes
    indicados (o para TODOS si `incidente_ids` es None — usado por el rebuild
    completo). No borra nada primero: a diferencia del CLI completo, esto se puede
    llamar repetidamente sobre un subconjunto sin afectar el resto de la caché.
    Retorna cuántos incidentes se poblaron."""
    propia_repo = PropiaIncidenciaRepository(propia_session)
    cache_repo = IncidenciaCacheRepository(redis)
    catastro_svc = CatastroEnrichmentService(sig_session)

    mapa_estados_inv = {v: k for k, v in (await propia_repo.mapa_estados()).items()}
    mapa_prioridades_inv = {v: k for k, v in (await propia_repo.mapa_prioridades()).items()}
    prioridad_default = await propia_repo.prioridad_default_codigo()
    prioridad_default_id = mapa_prioridades_inv.get(prioridad_default) if prioridad_default else None

    query = select(Incidente).join(Incidente.tipo_atencion)
    if incidente_ids is not None:
        if not incidente_ids:
            return 0
        query = query.where(Incidente.incidente_id.in_(incidente_ids))
    incidentes = list(await propia_session.scalars(query))

    poblados = 0
    for incidente in incidentes:
        estado_row = await propia_repo.get_estado_actual(incidente.incidente_id)
        estado_id = estado_row.estado_id if estado_row else mapa_estados_inv.get("CREADO")

        categoria = incidente.tipo_atencion.tipo_grupo.codigo
        predio = await catastro_svc.resolver_predio(incidente.suministro_codigo, categoria)

        kwargs: dict[str, str] = {}
        if estado_id is not None:
            kwargs["estado_actual_id"] = str(estado_id)
        if predio is not None:
            kwargs["sector_id"] = str(predio.sector_id)
            kwargs["sector_nombre"] = predio.sector_nombre
            kwargs["distrito_id"] = str(predio.distrito_id)
        if prioridad_default_id is not None:
            kwargs["prioridad_id"] = str(prioridad_default_id)

        if kwargs:
            await cache_repo.set_resumen(str(incidente.incidente_id), **kwargs)
            poblados += 1
            if verbose:
                print(f"  {incidente.codigo}: {kwargs}")

    return poblados


async def main() -> None:
    propia_engine = create_async_engine(settings.propia_db_url, connect_args=propia_connect_args())
    sig_engine = create_async_engine(settings.sig_db_url_effective)
    PropiaSession = async_sessionmaker(propia_engine, expire_on_commit=False)
    SigSession = async_sessionmaker(sig_engine, expire_on_commit=False)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)

    borradas = await _limpiar_claves(redis)
    print(f"Claves anteriores borradas: {borradas}")

    async with PropiaSession() as propia_session, SigSession() as sig_session:
        poblados = await poblar_cache_incidentes(
            propia_session=propia_session, sig_session=sig_session, redis=redis, verbose=True
        )
        print(f"Incidentes poblados: {poblados}")

    await propia_engine.dispose()
    await sig_engine.dispose()
    await redis.aclose()
    print("Reconstrucción completa.")


if __name__ == "__main__":
    asyncio.run(main())
