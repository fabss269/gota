"""Scheduler interno (APScheduler) para el pull automático a la API de DANA —
decisión 2026-08-04 con Edgar: corre dentro del propio proceso uvicorn, sin cron
externo ni infraestructura nueva fuera de la app. El Dockerfile de producción no
pasa `--workers` (un solo proceso), así que no hay riesgo de que dos workers
dupliquen el job — si en algún momento se agregan más workers, este scheduler
tendría que moverse a un proceso aparte (o usar un lock distribuido) para no pull-ear
2x.

No dispara una corrida inmediata al arrancar la app: la primera corrida automática
espera `dana_poll_interval_seconds`. Para cargar de inmediato (dev, o forzar un pull
antes de esperar el intervalo) usar el endpoint manual
`POST /incidencias/ingest/dana` (mismo `ingerir_tickets_dana`, ver
app/modules/incidencias/dana_ingest.py).
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.modules.incidencias.dana_ingest import ingerir_tickets_dana

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _job_ingest_dana() -> None:
    try:
        resumen = await ingerir_tickets_dana()
        logger.info("Ingest DANA (scheduler) completado: %s", resumen)
    except Exception:
        # Una corrida fallida (ej. DANA/dana_mock caído) no debe tumbar el
        # scheduler — la siguiente corrida programada reintenta sola, y el
        # checkpoint (MAX(fecha_registro) ya cargado) es self-healing: no hay
        # estado propio que se pueda perder o desincronizar por un fallo puntual.
        logger.exception("Ingest DANA (scheduler) falló, reintenta en la próxima corrida")


def iniciar_scheduler() -> None:
    scheduler.add_job(
        _job_ingest_dana,
        "interval",
        seconds=settings.dana_poll_interval_seconds,
        id="ingest_dana",
        replace_existing=True,
    )
    scheduler.start()


def detener_scheduler() -> None:
    scheduler.shutdown(wait=False)
