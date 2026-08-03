"""Endpoints para cargar tickets al sistema, ambos usando el mismo ETL:

- POST /incidencias/ingest/excel     -> sube un xlsx y lo procesa
- POST /incidencias/ingest/simular   -> simula la llegada de 1 incidencia por API

Ambos reutilizan la logica de:
- scripts.etl_tickets_crudos.normalizar (regex, split por suministro)
- scripts.tickets_loader.cargar_dataframe / cargar_sin_suministro (escritura en gota)
"""

from __future__ import annotations

import os
import tempfile
from datetime import UTC, datetime
from typing import Annotated, Literal

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from scripts.etl_tickets_crudos import (
    es_robo,
    extraer_problema_direccion,
    extraer_tecnico,
    normalizar,
)
from scripts.tickets_loader import cargar_dataframe, cargar_sin_suministro

router = APIRouter(prefix="/incidencias/ingest", tags=["ingest"])


# ============================================================================
# Modelo de entrada para /simular
# ============================================================================
class IncidenciaCreate(BaseModel):
    """Payload de una incidencia nueva llegando por API (simulacion). Los campos de
    resolucion (usuario_soluciona, fecha_solucion, detalle_de_solucion) NO estan
    presentes porque los tickets recien creados no estan resueltos todavia."""

    # Suministro y ubicacion
    suministro: str | None = Field(default=None, description="8 digitos con ceros a la izquierda. None si no se capturo")
    direccion: str | None = None
    distrito: str = Field(description="Ej: CHICLAYO, LA VICTORIA, JOSE LEONARDO ORTIZ")

    # Persona reclamante
    persona: str
    dni: str = Field(min_length=8, max_length=8)
    celular: str = Field(min_length=9, max_length=9)
    telefono_fijo: str | None = None
    correo: str | None = None
    parentesco: Literal["TITULAR", "FAMILIAR", "INQUILINO", "EXTRAÑO"]

    # Clasificacion
    alcance: Literal["general", "particular"]
    medio_recepcion: Literal[
        "presencial", "telefono", "app", "correo electrónico",
        "formulario web", "redes sociales",
    ]
    tipo_grupo: Literal["AGUA", "DESAGUE"]
    tipo_de_atencion: str = Field(description="Ej: 'ATORO EN COLECTORES Y/O DESBORDE ALCANTARILLADO'")

    # Detalle
    detalle_del_ticket: str = Field(description="Texto libre que ingresa el operador")

    # Usuario del sistema que registra
    usuario_registra: str = Field(description="username en minusculas, ej: pedro.garcia")


# ============================================================================
# Endpoint 1: subir Excel
# ============================================================================
@router.post("/excel", status_code=status.HTTP_200_OK)
async def cargar_excel(archivo: Annotated[UploadFile, File(...)]) -> dict:
    """Recibe un xlsx con el mismo formato del reporte oficial y lo procesa por el
    mismo ETL que usa el CLI (`scripts.etl_tickets_crudos`)."""
    if not archivo.filename or not archivo.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Solo se aceptan archivos Excel (.xlsx, .xls)",
        )

    # Guardar temporalmente para que pd.read_excel lo pueda leer
    contenido = await archivo.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(contenido)
        tmp_path = tmp.name

    try:
        df_crudo = pd.read_excel(tmp_path)
        df, df_sin = normalizar(df_crudo)

        n_con_suministro = len(df)
        n_sin_suministro = len(df_sin)

        if not df.empty:
            await cargar_dataframe(df)
        if not df_sin.empty:
            await cargar_sin_suministro(df_sin)

        return {
            "archivo": archivo.filename,
            "filas_leidas": len(df_crudo),
            "con_suministro_procesados": n_con_suministro,
            "sin_suministro_procesados": n_sin_suministro,
            "mensaje": "Carga completada (ver logs para dedup y detalles)",
        }
    finally:
        os.unlink(tmp_path)


# ============================================================================
# Endpoint 2: simular UNA incidencia llegando por API
# ============================================================================
@router.post("/simular", status_code=status.HTTP_201_CREATED)
async def simular_incidencia(datos: IncidenciaCreate) -> dict:
    """Simula la llegada de una incidencia nueva por API. Genera un TICKET unico,
    aplica los mismos regex del ETL de Excel, y usa el loader compartido para
    escribir en gota (con dedup por 72h si aplica) o en reclamo_sin_suministro."""

    # 1. Extraer campos del detalle con los mismos regex del ETL
    problema, direccion_detalle = extraer_problema_direccion(datos.detalle_del_ticket)
    tecnico = extraer_tecnico(datos.detalle_del_ticket)
    es_robo_bool = es_robo(datos.detalle_del_ticket)

    # 2. Generar TICKET unico — timestamp en ms (13 chars) para no colisionar con
    # los del Excel (5 chars). Es suficientemente unico para simulacion.
    ticket_id = str(int(datetime.now(UTC).timestamp() * 1000))

    # 3. Zero-pad suministro si viene con menos de 8 chars
    suministro_norm = datos.suministro.zfill(8) if datos.suministro else None

    # 4. Armar el DataFrame de 1 fila con las columnas que espera el loader
    fila = {
        "TICKET": ticket_id,
        "ALCANCE": datos.alcance,
        "MEDIO_RECEPCION": datos.medio_recepcion,
        "FECHA_REGISTRO": datetime.now(UTC).replace(tzinfo=None),
        "USUARIO_REGISTRA": datos.usuario_registra.lower(),
        "DISTRITO": datos.distrito,
        "SUMINISTRO": suministro_norm,
        "DIRECCION": datos.direccion,
        "PERSONA": datos.persona,
        "DNI": datos.dni.zfill(8),
        "CELULAR": datos.celular,
        "TELEFONO_FIJO": datos.telefono_fijo,
        "CORREO_ELECTRONICO": datos.correo,
        "PARENTESCO": datos.parentesco,
        "TIPO_GRUPO": datos.tipo_grupo,
        "TIPO_DE_ATENCION": datos.tipo_de_atencion,
        "DETALLE_DEL_TICKET": datos.detalle_del_ticket,
        "USUARIO_SOLUCIONA": None,       # ticket recien creado, no resuelto
        "DETALLE_DE_SOLUCION": None,
        "FECHA_SOLUCION": pd.NaT,
        "problema": problema,
        "direccion_detalle": direccion_detalle,
        "tecnico": tecnico,
        "es_robo": es_robo_bool,
    }
    df = pd.DataFrame([fila])

    # 5. Cargar por la rama correspondiente (con/sin suministro)
    if suministro_norm:
        await cargar_dataframe(df)
    else:
        await cargar_sin_suministro(df)

    return {
        "ticket_id": ticket_id,
        "suministro": suministro_norm,
        "destino": "gota.incidente/reclamo" if suministro_norm else "gota.reclamo_sin_suministro",
        "problema_extraido": problema,
        "tecnico_extraido": tecnico,
        "es_robo_detectado": es_robo_bool,
    }
