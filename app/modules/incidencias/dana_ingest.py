"""Ingest automático de tickets desde la API de DANA (o su simulación en
dana_mock/, mientras DANA no nos da acceso real — ver `settings.dana_api_base_url`).

Reutiliza el mismo pipeline que ya usan `/ingest/excel` y `/ingest/simular`:
`scripts.etl_tickets_crudos.tickets_dana_a_dataframes` + `scripts.tickets_loader`
(carga en gota, dedup por TICKET). Decisión 2026-08-04 con Edgar: por ahora
solo-inserción — un ticket que ya está cargado y vuelve más tarde con
usuario_soluciona/fecha_solucion recién llenos se SALTA igual que cualquier
duplicado (no hay upsert todavía). Si en la práctica esto pierde información de
resolución con frecuencia, hay que revisar tickets_loader.cargar_dataframe.

También puebla la caché Redis (`scripts.rebuild_incidencia_cache.poblar_cache_incidentes`)
para los incidentes tocados en cada pull — `tickets_loader` escribe directo a Postgres
y nunca toca Redis, así que sin este paso los incidentes cargados por acá quedaban
invisibles en `GET /incidencias` (bug real encontrado 2026-08-04 verificando el
pipeline completo en vivo: la BD sí tenía los datos, el mapa mostraba 0).
"""

from __future__ import annotations

from datetime import datetime, timedelta

import asyncpg
import httpx

from app.core.config import propia_connect_args, settings
from app.db.propia import PropiaSessionFactory
from app.db.redis import redis_client
from app.db.sig import SigSessionFactory
from scripts.etl_tickets_crudos import tickets_dana_a_dataframes
from scripts.rebuild_incidencia_cache import poblar_cache_incidentes
from scripts.tickets_loader import cargar_dataframe, cargar_sin_suministro


def _to_asyncpg_dsn(sqlalchemy_url: str) -> str:
    return sqlalchemy_url.replace("postgresql+asyncpg://", "postgresql://")


async def _checkpoint_fecha_desde() -> datetime | None:
    """MAX(fecha_registro) ya cargado en reclamo/reclamo_sin_suministro, menos un
    margen de solape defensivo (dana_poll_overlap_seconds) — None si la BD todavía no
    tiene ningún ticket propio (primer pull: trae todo el historial disponible en
    DANA, sin filtro de fecha)."""
    conn = await asyncpg.connect(
        dsn=_to_asyncpg_dsn(settings.propia_db_url),
        server_settings=propia_connect_args()["server_settings"],
    )
    try:
        max_reclamo = await conn.fetchval("SELECT MAX(fecha_registro) FROM reclamo")
        max_sin_suministro = await conn.fetchval(
            "SELECT MAX(fecha_registro) FROM reclamo_sin_suministro"
        )
    finally:
        await conn.close()

    candidatos = [f for f in (max_reclamo, max_sin_suministro) if f is not None]
    if not candidatos:
        return None
    return max(candidatos) - timedelta(seconds=settings.dana_poll_overlap_seconds)


async def _fetch_tickets_dana(fecha_desde: datetime | None, **filtros: str | None) -> list[dict]:
    """Trae TODOS los tickets que matchean el filtro, paginando por offset/limit
    hasta agotar `total` que devuelve la API (un solo pull puede superar el límite
    de una página)."""
    params: dict[str, str] = {k: v for k, v in filtros.items() if v is not None}
    if fecha_desde is not None:
        params["fecha_desde"] = fecha_desde.isoformat()

    tickets: list[dict] = []
    offset = 0
    limit = 200
    async with httpx.AsyncClient(base_url=settings.dana_api_base_url, timeout=30) as client:
        while True:
            resp = await client.get(
                "/incidencias", params={**params, "limit": limit, "offset": offset}
            )
            resp.raise_for_status()
            data = resp.json()
            tickets.extend(data["resultados"])
            offset += limit
            if offset >= data["total"]:
                break
    return tickets


async def _incidente_ids_por_ticket(tickets: list[str]) -> list:
    """`incidente_id`s tocados por estos TICKET (nuevos o reutilizados por dedup
    72h) — con esto alcanza para saber a quién hay que (re)poblar en la caché,
    sin tener que tocar el resto de `incidente` que no cambió en este pull."""
    if not tickets:
        return []
    conn = await asyncpg.connect(
        dsn=_to_asyncpg_dsn(settings.propia_db_url),
        server_settings=propia_connect_args()["server_settings"],
    )
    try:
        rows = await conn.fetch(
            "SELECT DISTINCT incidente_id FROM reclamo WHERE ticket_original = ANY($1::varchar[])",
            tickets,
        )
    finally:
        await conn.close()
    return [r["incidente_id"] for r in rows]


async def _poblar_cache_nuevos(tickets_con: list[str]) -> int:
    """Puebla Redis (estado/prioridad/sector) para los incidentes tocados por este
    pull — sin esto, GET /incidencias no los encuentra: el filtro de
    prioridad/estado/sector resuelve candidatos desde los índices invertidos de
    Redis, no desde Postgres directamente (bug real encontrado 2026-08-04, ver
    scripts/rebuild_incidencia_cache.py). `tickets_loader` escribe directo a
    Postgres via asyncpg y nunca toca Redis — este paso es lo que lo completa."""
    incidente_ids = await _incidente_ids_por_ticket(tickets_con)
    if not incidente_ids:
        return 0
    async with PropiaSessionFactory() as propia_session, SigSessionFactory() as sig_session:
        return await poblar_cache_incidentes(
            propia_session=propia_session,
            sig_session=sig_session,
            redis=redis_client,
            incidente_ids=incidente_ids,
        )


async def ingerir_tickets_dana(
    *,
    distrito: str | None = None,
    tipo_grupo: str | None = None,
    alcance: str | None = None,
    medio_recepcion: str | None = None,
) -> dict:
    """Punto de entrada único: lo usa tanto el scheduler interno
    (app/core/scheduler.py, corre solo cada `dana_poll_interval_seconds`) como el
    endpoint manual `POST /incidencias/ingest/dana` — mismo comportamiento en
    ambos casos, mismos filtros opcionales."""
    fecha_desde = await _checkpoint_fecha_desde()
    tickets = await _fetch_tickets_dana(
        fecha_desde,
        distrito=distrito,
        tipo_grupo=tipo_grupo,
        alcance=alcance,
        medio_recepcion=medio_recepcion,
    )

    resumen: dict = {
        "fecha_desde_usada": fecha_desde.isoformat() if fecha_desde else None,
        "tickets_recibidos": len(tickets),
        "con_suministro_procesados": 0,
        "sin_suministro_procesados": 0,
    }
    if not tickets:
        return resumen

    df_con, df_sin = tickets_dana_a_dataframes(tickets)
    resumen["con_suministro_procesados"] = len(df_con)
    resumen["sin_suministro_procesados"] = len(df_sin)

    if not df_con.empty:
        await cargar_dataframe(df_con)
        resumen["cache_incidentes_poblados"] = await _poblar_cache_nuevos(
            df_con["TICKET"].tolist()
        )
    if not df_sin.empty:
        await cargar_sin_suministro(df_sin)

    return resumen
