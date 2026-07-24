from pydantic import BaseModel


class DistritoOut(BaseModel):
    id: str
    nombre: str


class SectorOut(BaseModel):
    id: str
    nombre: str


class TipoAtencionOut(BaseModel):
    id: str
    nombre: str
    categoria: str
