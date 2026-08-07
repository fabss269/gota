from pydantic import BaseModel


class ElementoRedOut(BaseModel):
    """Info enriquecida de un elemento de catastro para el panel de detalle del mapa
    (click en un tramo/tubería/buzón/accesorio/caja/manzana/lote). Un solo DTO plano
    con todo opcional en vez de un modelo por tipo: los campos que no aplican a un
    tipo dado simplemente vienen `None` y el frontend los omite."""

    tipo: str
    id: int
    codigo: str | None = None
    inscripcion: str | None = None
    tipoNombre: str | None = None
    material: str | None = None
    diametroPulgadas: float | None = None
    primaria: bool | None = None
    profundidad: float | None = None
    cota: float | None = None
    cotaFondo: float | None = None
    referencia: str | None = None
    nombre: str | None = None
    area: float | None = None
    perimetro: float | None = None
    sectorId: int | None = None
    sectorNombre: str | None = None
    distritoId: int | None = None
    distritoNombre: str | None = None
