from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

MotivoAvance = Literal[
    "CUADRILLA_EN_SITIO",
    "SE_RESOLVIO",
    "REQUIERE_EQUIPO",
    "DERIVAR_OTRA_AREA",
    "REASIGNAR_TECNICO",
    "EN_ESPERA",
    "NO_SE_PUDO_ATENDER",
]


class IncidenciaOut(BaseModel):
    id: str
    tipo: str
    categoria: str
    direccion: str | None
    sector: str | None
    prioridad: str | None
    estado: str
    antiguedadDias: int
    lat: float | None
    lon: float | None
    fechaCreacion: datetime


class IncidenciaListResponse(BaseModel):
    items: list[IncidenciaOut]
    page: int
    pageSize: int
    total: int


class TecnicoAsignadoOut(BaseModel):
    id: str
    nombre: str


class ReclamoResumenOut(BaseModel):
    fechaRegistro: datetime
    medioRecepcion: str
    descripcion: str | None


class CatastroOut(BaseModel):
    redAsociada: str | None
    diametroMm: float | None
    material: str | None
    buzonCercano: str | None
    sector: str | None


class PredioOut(BaseModel):
    noReincidente: bool
    quejasUltimos6Meses: int


class FocoOut(BaseModel):
    descripcion: str
    incidenciasRelacionadasIds: list[str]


class IncidenciaDetalleOut(BaseModel):
    id: str
    tipo: str
    categoria: str
    direccion: str | None
    prioridad: str | None
    estado: str
    antiguedadDias: int
    tecnicoAsignado: TecnicoAsignadoOut | None
    reclamo: ReclamoResumenOut | None
    catastro: CatastroOut | None
    quejasAgrupadas: int
    predio: PredioOut
    foco: FocoOut | None


class TrazabilidadPasoOut(BaseModel):
    estado: str
    fecha: datetime
    grupo: str | None = None
    asignadoA: str | None = None
    nota: str | None = None


class PredioReclamoOut(BaseModel):
    id: str
    tipo: str
    fecha: datetime


class TransicionOut(BaseModel):
    hacia: str
    requiereFormulario: bool


class AvanceRequest(BaseModel):
    motivo: MotivoAvance
    nota: str | None = None


class EstadoPatchRequest(BaseModel):
    estado: str


class ResponsablePatchRequest(BaseModel):
    """Al menos uno de los dos campos — confirmado con Edgar: la asignación vive por
    evento (`estado_incidente_evento`), ambos campos son nullable ahí, así que un
    evento puede tocar solo técnico, solo área, o ambos, sin heredar el que falte del
    evento anterior (quien quiera "el área actual" consulta el último evento con
    `area_id IS NOT NULL`, igual que ya se hace para `tecnicoAsignado`)."""

    tecnicoId: str | None = None
    areaId: int | None = None

    @model_validator(mode="after")
    def _al_menos_uno(self) -> "ResponsablePatchRequest":
        if self.tecnicoId is None and self.areaId is None:
            raise ValueError("Debe indicarse tecnicoId y/o areaId")
        return self
