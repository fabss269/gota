from pydantic import BaseModel


class BboxOut(BaseModel):
    """Extent en WGS84 (lon/lat), listo para `map.fitBounds` en el cliente."""

    minLon: float
    minLat: float
    maxLon: float
    maxLat: float


class ProvinciaOut(BaseModel):
    id: str
    nombre: str
    bbox: BboxOut


class DistritoOut(BaseModel):
    id: str
    nombre: str
    provinciaId: str
    bbox: BboxOut


class SectorOut(BaseModel):
    id: str
    nombre: str
    distritoId: str
    bbox: BboxOut


class SuministroOut(BaseModel):
    lat: float
    lon: float
    sectorId: int | None
    sectorNombre: str | None


class TipoAtencionOut(BaseModel):
    id: str
    nombre: str
    categoria: str


class TipoGrupoOut(BaseModel):
    """Grupo de incidencia: agua / desagüe (gota.catalogo_tipo_grupo)."""

    id: int
    codigo: str
    nombre: str
