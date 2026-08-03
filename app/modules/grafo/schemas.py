from datetime import datetime
from typing import Literal

from pydantic import BaseModel

TipoFalla = Literal[
    "atoro_tramo", "colapso_buzon", "falla_conexion", "tapa_faltante", "fuga_tuberia", "fuga_accesorio"
]
TipoRed = Literal["agua", "desague"]


class AfectadoOut(BaseModel):
    suministro: str
    cajaId: int
    infraId: int | None
    nivel: int
    horasEstimadas: int | None = None
    prioridad: str | None = None


class ImpactoOut(BaseModel):
    tipoFalla: TipoFalla | None
    elementoTipo: str | None
    elementoId: int | None
    afectados: list[AfectadoOut]


class ElementoRedOut(BaseModel):
    elementoTipo: str
    elementoId: int
    nivel: int


class SimulacionOut(BaseModel):
    """Respuesta de POST /grafo/simulacion (click interactivo en el mapa, modo
    simulación): además de los suministros afectados, trae la sub-red completa
    recorrida por el BFS (tramos/tuberías/buzones/accesorios) para que el
    frontend pueda pintar la red completa en modo vista, no solo las cajas
    terminales."""

    tipoFalla: TipoFalla
    elementoTipo: str
    elementoId: int
    afectados: list[AfectadoOut]
    redAfectada: list[ElementoRedOut]


class FocoActivoOut(BaseModel):
    infraId: int
    tipoRed: TipoRed
    nReclamos: int
    nSuministros: int
    primerTicket: datetime
    ultimoTicket: datetime
    diasActivo: float | None = None
    tipoDominante: str | None = None


class SimulacionRequest(BaseModel):
    tipoFalla: TipoFalla
    elementoId: int
