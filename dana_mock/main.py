"""API de Simulación de DANA — servicio standalone, deliberadamente separado de
gota-backend (Dockerfile propio, sin credenciales de BD) porque representa un
sistema EXTERNO que no controlamos: el día que DANA nos dé acceso a su API real,
este servicio se apaga y `dana_ingest.py` en gota-backend apunta a la URL real sin
tocar nada más de ese lado.

GET /incidencias replica el formato de ticket crudo que DANA ya nos mostró (ver
conversación con Edgar 2026-08-04), con params de fecha/filtro para que el backend
pueda pedir "solo lo nuevo desde X" en vez de traer todo el historial cada vez.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

from dana_mock.generator import _ahora_utc_naive, generar_tickets_hasta

app = FastAPI(title="DANA — API de Simulación", description=__doc__)

_MEDIOS_VALIDOS = {
    "presencial", "telefono", "app", "correo electrónico",
    "formulario web", "redes sociales",
}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/incidencias")
async def listar_incidencias(
    fecha_desde: Annotated[
        datetime | None,
        Query(
            description="Solo tickets con fecha_registro >= este valor (ISO 8601). "
            "Así el consumidor pide solo lo nuevo desde su última carga."
        ),
    ] = None,
    fecha_hasta: Annotated[
        datetime | None, Query(description="fecha_registro <= este valor")
    ] = None,
    distrito: Annotated[
        str | None, Query(description="Ej: CHICLAYO (case-insensitive)")
    ] = None,
    tipo_grupo: Annotated[Literal["AGUA", "DESAGUE"] | None, Query()] = None,
    alcance: Annotated[Literal["general", "particular"] | None, Query()] = None,
    medio_recepcion: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JSONResponse:
    if medio_recepcion is not None and medio_recepcion not in _MEDIOS_VALIDOS:
        return JSONResponse(
            status_code=422,
            content={"detail": f"medio_recepcion inválido, esperado uno de {sorted(_MEDIOS_VALIDOS)}"},
        )

    # Naive-pero-UTC (mismo criterio que el resto del proyecto, ver
    # specs/00-arquitectura.md §0) — NO alcanza con `datetime.now()` a secas, que da
    # la hora LOCAL del sistema: bug real encontrado 2026-08-04 corriendo esto en un
    # sandbox de dev en horario de Perú (-05) contra un EPOCH pensado en UTC, ver
    # `_ahora_utc_naive` en generator.py.
    ahora = _ahora_utc_naive()
    tickets = generar_tickets_hasta(ahora)

    def cumple_filtros(t: dict) -> bool:
        fecha_registro = datetime.fromisoformat(t["fecha_registro"])
        if fecha_registro > ahora:
            return False  # no "adelantar" tickets del futuro dentro del mismo día
        if fecha_desde is not None and fecha_registro < fecha_desde:
            return False
        if fecha_hasta is not None and fecha_registro > fecha_hasta:
            return False
        if distrito is not None and t["distrito"].upper() != distrito.upper():
            return False
        if tipo_grupo is not None and t["tipo_grupo"] != tipo_grupo:
            return False
        if alcance is not None and t["alcance"] != alcance:
            return False
        return medio_recepcion is None or t["medio_recepcion"] == medio_recepcion

    filtrados = [t for t in tickets if cumple_filtros(t)]
    filtrados.sort(key=lambda t: t["fecha_registro"])
    pagina = filtrados[offset : offset + limit]

    return JSONResponse(
        content={
            "total": len(filtrados),
            "limit": limit,
            "offset": offset,
            "resultados": pagina,
        }
    )
