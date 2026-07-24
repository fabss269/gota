"""Reconstruye desde cero la caché Redis de `estado`/`prioridad`/`sector` de
`incidente` (specs/00-arquitectura.md §7).

Es una caché externa, desechable por definición: si se pierde o se vacía, se
reconstruye por completo desde Postgres+`sig` sin perder información, porque nunca fue
la única fuente de esos datos. Correr en el primer deploy, o si Redis se vació/perdió.

Uso: .venv/bin/python -m scripts.rebuild_incidencia_cache
"""

import asyncio

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
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


async def main() -> None:
    propia_engine = create_async_engine(settings.propia_db_url)
    sig_engine = create_async_engine(settings.sig_db_url)
    PropiaSession = async_sessionmaker(propia_engine, expire_on_commit=False)
    SigSession = async_sessionmaker(sig_engine, expire_on_commit=False)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)

    borradas = await _limpiar_claves(redis)
    print(f"Claves anteriores borradas: {borradas}")

    async with PropiaSession() as propia_session, SigSession() as sig_session:
        propia_repo = PropiaIncidenciaRepository(propia_session)
        cache_repo = IncidenciaCacheRepository(redis)
        catastro_svc = CatastroEnrichmentService(sig_session)

        mapa_estados_inv = {v: k for k, v in (await propia_repo.mapa_estados()).items()}
        mapa_prioridades_inv = {v: k for k, v in (await propia_repo.mapa_prioridades()).items()}
        prioridad_default = await propia_repo.prioridad_default_codigo()
        prioridad_default_id = (
            mapa_prioridades_inv.get(prioridad_default) if prioridad_default else None
        )

        incidentes = list(
            await propia_session.scalars(select(Incidente).join(Incidente.tipo_atencion))
        )
        print(f"Incidentes a procesar: {len(incidentes)}")

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
                print(f"  {incidente.codigo}: {kwargs}")

    await propia_engine.dispose()
    await sig_engine.dispose()
    await redis.aclose()
    print("Reconstrucción completa.")


if __name__ == "__main__":
    asyncio.run(main())
