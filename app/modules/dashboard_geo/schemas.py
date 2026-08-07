from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Periodo = Literal["anual", "mensual"]
Grupo = Literal["agua", "desague", "todos"]
NivelAlerta = Literal["rojo", "amarillo", "verde"]


class ReclamoDetalleOut(BaseModel):
    fecha: datetime
    detalle: str | None


class IncidenciaPopupOut(BaseModel):
    codigo: str
    suministro: str | None
    direccion: str | None
    tipo_atencion: str
    grupo: str
    sector: str | None
    creado_en: datetime
    fecha_solucion: datetime | None
    dias_hasta_solucion: int | None
    sin_solucion: bool
    reclamos: list[ReclamoDetalleOut]


# ============ KPIs ============

class KpiPuntoSparklineOut(BaseModel):
    x: str
    y: float


class KpiOut(BaseModel):
    valor: float
    delta_pct: float | None
    delta_abs: float | None
    sparkline: list[KpiPuntoSparklineOut]


class KpisOut(BaseModel):
    volumen: KpiOut
    tiempo_mediano_dias: KpiOut
    robos: KpiOut
    sin_solucion: KpiOut


# ============ Storytelling ============

class StorytellingOut(BaseModel):
    periodo: str
    texto: str


# ============ Rankings ============

class SectorRankOut(BaseModel):
    sectorid: int | None
    sector: str
    n_incidencias: int
    n_agua: int
    n_desague: int


class HeatmapSectorOut(BaseModel):
    sectorid: int
    sector: str
    n_incidencias: int
    densidad_por_km2: float


class TramoRankOut(BaseModel):
    tramo_id: int
    tramo_tipo: str
    direccion_muestra: str | None
    sectorid: int | None
    sector: str | None
    n_incidencias: int


# ============ Series temporales ============

class SeriePuntoOut(BaseModel):
    x: str
    y: float


class SerieMensualOut(BaseModel):
    actual: list[SeriePuntoOut]
    anio_anterior: list[SeriePuntoOut]
    prediccion: list[SeriePuntoOut]


class SerieTiempoResolucionOut(BaseModel):
    puntos: list[SeriePuntoOut]


class SerieStackedPuntoOut(BaseModel):
    x: str
    valores: dict[str, float]   # {tipo_atencion: cantidad}


class SerieStackedOut(BaseModel):
    tipos: list[str]
    puntos: list[SerieStackedPuntoOut]


# ============ Reincidentes / Sin solución / Multi-reclamos ============

class ReincidenteOut(BaseModel):
    suministro: str
    direccion: str | None
    sector: str | None
    n_incidencias: int
    tipo_dominante: str
    ultima_fecha: datetime


class SinSolucionRowOut(BaseModel):
    codigo: str
    tipo_atencion: str
    sector: str | None
    direccion: str | None
    dias_sin_resolver: int


class MultiReclamoOut(BaseModel):
    codigo: str
    direccion: str | None
    sector: str | None
    n_reclamos: int
    tipo_atencion: str


# ============ Parentesco ============

class ParentescoSliceOut(BaseModel):
    parentesco: str
    n: int
    pct: float


# ============ Alertas semáforo ============

class AlertaOut(BaseModel):
    nivel: NivelAlerta
    mensaje: str
    link: str | None = None


# ============ Regresión / Predicción ============

class PrediccionSectorOut(BaseModel):
    sectorid: int
    sector: str
    tendencia: Literal["creciente", "decreciente", "estable"]
    pred_proximo_mes: int
    cambio_pct_mensual: float
