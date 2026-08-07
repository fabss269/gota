from pydantic import BaseModel, model_validator


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


class ElementoRedPatchIn(BaseModel):
    """Body de PATCH /red/elemento/{tipo}/{id} — edición inline (estilo Jira) de
    diámetro/material de un tramo. Ambos opcionales, pero al menos uno requerido;
    el service valida cuáles aplican según `tipo` (diametroPulgadas solo en
    tuberia — sig.alcantarillado no tiene esa columna, ver memoria del proyecto)."""

    diametroPulgadas: float | None = None
    materialId: int | None = None

    @model_validator(mode="after")
    def _al_menos_uno(self) -> "ElementoRedPatchIn":
        if self.diametroPulgadas is None and self.materialId is None:
            raise ValueError("Debe enviar diametroPulgadas y/o materialId")
        return self


class MaterialOut(BaseModel):
    id: int
    nombre: str
