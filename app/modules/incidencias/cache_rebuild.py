"""Rebuild y self-check de los indices Redis (`idx:sector:*`, `idx:prioridad:*`,
`idx:estado:*`) desde SQL.

Motivacion: los indices se lazy-populate al leer incidentes. Cuando la BD se
restaura de un backup, los `incidente_id` (uuids autogenerados) cambian por
completo mientras Redis retiene los uuids del snapshot anterior. Resultado
observable: la interseccion `sector ∩ prioridad` devolvia ~0 filas hasta
correr un rebuild manual.

El self-check corre al arranque del backend (ver `main.py::lifespan`) y
auto-rebuildea si detecta drift significativo — asi restaurar la BD no
requiere pasos manuales adicionales.
"""

import logging

from redis.asyncio import Redis
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models_propia import CatalogoEstado, Incidente

log = logging.getLogger(__name__)

# Umbrales del self-check:
#   - Si diferencia relativa entre "uuids en Redis" y "COUNT(*) en BD" es
#     mayor a este ratio, se dispara el rebuild automatico.
#   - 0.05 = 5%: filtra ruido normal (lazy-load de un puñado de incidentes
#     que aun no fueron leidos) sin dejar pasar restauraciones de backup
#     (que dan >90% de mismatch).
DRIFT_RATIO_MAX = 0.05


async def contar_bd(propia: AsyncSession) -> int:
    return int(await propia.scalar(select(text('COUNT(*)')).select_from(Incidente)) or 0)


async def _redis_incidentes_total(redis: Redis) -> int:
    """Suma de todos los `idx:estado:*` — indexa 1 uuid por incidente (cada
    uno tiene exactamente un estado actual), así que la suma equivale al total
    de incidentes conocidos por Redis. Antes usábamos idx:prioridad:{default}
    con el mismo propósito, pero ese índice ya no existe."""
    total = 0
    cursor = 0
    while True:
        cursor, keys = await redis.scan(cursor=cursor, match='idx:estado:*', count=500)
        for k in keys:
            total += int(await redis.scard(k))
        if cursor == 0:
            break
    return total


async def _estado_creado_id(propia: AsyncSession) -> int:
    row = await propia.scalar(
        select(CatalogoEstado.estado_id).where(CatalogoEstado.codigo == 'CREADO').limit(1)
    )
    if row is None:
        raise RuntimeError("catalogo_estado no tiene 'CREADO' - no se puede rebuildear")
    return int(row)


async def rebuild(propia: AsyncSession, sig: AsyncSession, redis: Redis) -> dict:
    """Reconstruye idx:sector:*, idx:prioridad:*, idx:estado:* e incidente:*.

    Politica de sector: cajaagua primero, fallback cajadesague (ver
    [[project-gota-sector-policy]] y catastro_enrichment.resolver_predio).
    Sentinela '00000000' excluido.
    """
    # 1) Limpiar sets/hashes viejos - evita huerfanos de la BD anterior.
    # `idx:prioridad:*` se limpia y NO se repuebla — la prioridad ahora se
    # calcula al vuelo en SQL desde `creado_en` (ver `_prioridad_codigo_expr`
    # en propia_repository), no se persiste en Redis.
    for pattern in ('idx:sector:*', 'idx:prioridad:*', 'idx:estado:*', 'incidente:*'):
        cursor = 0
        while True:
            cursor, keys = await redis.scan(cursor=cursor, match=pattern, count=500)
            if keys:
                await redis.delete(*keys)
            if cursor == 0:
                break

    estado_creado = await _estado_creado_id(propia)

    # 2) Resolver sector por suministro (regla cajaagua > cajadesague)
    #    Se hace en SIG porque las tablas cajaagua/cajadesague viven ahi.
    sector_rows = await sig.execute(text("""
        SELECT DISTINCT ON (inscripcion) inscripcion, sectorid
        FROM (
            SELECT inscripcion, sectorid, 1 AS prio FROM sig.cajaagua
            WHERE inscripcion IS NOT NULL AND inscripcion <> '00000000'
            UNION ALL
            SELECT inscripcion, sectorid, 2 AS prio FROM sig.cajadesague
            WHERE inscripcion IS NOT NULL AND inscripcion <> '00000000'
        ) t
        ORDER BY inscripcion, prio, sectorid
    """))
    sector_por_suministro: dict[str, int] = {r.inscripcion: r.sectorid for r in sector_rows}

    # 3) Traer incidentes + ultimo estado (LATERAL para el DESC LIMIT 1)
    inc_rows = await propia.execute(text("""
        SELECT
            i.incidente_id::text AS incidente_id,
            i.suministro_codigo,
            COALESCE(ult.estado_resultante_id, :estado_creado) AS estado_id
        FROM gota.incidente i
        LEFT JOIN LATERAL (
            SELECT e.estado_resultante_id
            FROM gota.estado_incidente_evento e
            WHERE e.incidente_id = i.incidente_id
            ORDER BY e.fecha DESC
            LIMIT 1
        ) ult ON TRUE
    """), {'estado_creado': estado_creado})

    total = 0
    con_sector = 0
    pipe = redis.pipeline(transaction=False)
    for r in inc_rows:
        total += 1
        uuid = r.incidente_id
        hset_fields: dict[str, str] = {'estado_actual_id': str(r.estado_id)}
        sector_id = sector_por_suministro.get(r.suministro_codigo)
        if sector_id is not None:
            hset_fields['sector_id'] = str(sector_id)
            pipe.sadd(f'idx:sector:{sector_id}', uuid)
            con_sector += 1
        # HSET con multiples campos - la firma acepta mapping keyword
        pipe.hset(f'incidente:{uuid}', mapping=hset_fields)
        pipe.sadd(f'idx:estado:{r.estado_id}', uuid)

        # Flush cada 2000 comandos para evitar acumular demasiado en memoria
        if len(pipe.command_stack) >= 2000:
            await pipe.execute()
            pipe = redis.pipeline(transaction=False)
    if pipe.command_stack:
        await pipe.execute()

    return {'total': total, 'con_sector': con_sector}


async def self_check_y_rebuild(
    propia: AsyncSession, sig: AsyncSession, redis: Redis
) -> None:
    """Compara conteos BD vs Redis; auto-rebuildea si hay drift significativo.

    Se llama una sola vez al arranque del backend desde `main.py::lifespan`.
    No falla el arranque si algo sale mal - solo loggea.
    """
    try:
        total_bd = await contar_bd(propia)
        redis_size = await _redis_incidentes_total(redis)

        # Caso limite: BD vacia - no hay nada que verificar
        if total_bd == 0:
            log.info('cache self-check: BD vacia, nada que rebuildear')
            return

        drift = abs(total_bd - redis_size) / total_bd
        log.info(
            'cache self-check: BD=%d, Redis=%d, drift=%.1f%% (umbral %.0f%%)',
            total_bd, redis_size, drift * 100, DRIFT_RATIO_MAX * 100,
        )

        if drift <= DRIFT_RATIO_MAX:
            return

        log.warning(
            'cache drift %.1f%% > umbral %.0f%%: rebuildeando indices de Redis...',
            drift * 100, DRIFT_RATIO_MAX * 100,
        )
        resultado = await rebuild(propia, sig, redis)
        log.warning(
            'cache rebuild completado: %d incidentes (%d con sector)',
            resultado['total'], resultado['con_sector'],
        )
    except Exception:
        log.exception('cache self-check fallo - el backend arranca igual')
