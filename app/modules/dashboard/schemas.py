from pydantic import BaseModel


class DashboardKpisOut(BaseModel):
    incidenciasAbiertasHoy: int
    incidenciasCriticas: int
    tiempoPromedioAtencionHoras: float
    cuadrillasActivas: int


class SerieTicketsPuntoOut(BaseModel):
    mes: str
    agua: int
    desague: int


class TopTipoAtencionOut(BaseModel):
    tipo: str
    cantidad: int


class PrioridadPorSectorOut(BaseModel):
    sectorId: str
    nombre: str
    antiguedadPromedioDias: float


class DashboardResumenOut(BaseModel):
    kpis: DashboardKpisOut
    porCategoria: dict[str, int]
    serieTickets: list[SerieTicketsPuntoOut]
    topTiposAtencion: list[TopTipoAtencionOut]
    prioridadPorSector: list[PrioridadPorSectorOut]
