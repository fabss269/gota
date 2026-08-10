from pydantic import BaseModel, model_validator


class ElementoRedOut(BaseModel):
    """Info enriquecida de un elemento de catastro para el panel de detalle del mapa.
    Un solo DTO plano con todo opcional: los campos que no aplican a un tipo dado
    vienen `None` y el frontend los omite. Los `*Id` conviven con los nombres para
    que el frontend pueda popular combos editables sin un segundo request."""

    tipo: str
    id: int
    codigo: str | None = None
    inscripcion: str | None = None
    nombre: str | None = None
    referencia: str | None = None

    # Tipo/subtipo (nombre + id para editar por combo)
    tipoNombre: str | None = None
    accesorioTipoId: int | None = None

    # Material (nombre + id)
    material: str | None = None
    materialId: int | None = None

    # Clasificación de accesorio (nombre + id)
    accesorioClasificacion: str | None = None
    accesorioClasificacionId: int | None = None

    # Numéricos
    diametroPulgadas: float | None = None
    pendiente: float | None = None
    distancia: float | None = None
    profundidad: float | None = None
    cota: float | None = None
    cotaFondo: float | None = None
    area: float | None = None
    perimetro: float | None = None

    # Booleano (alcantarillado: primaria vs secundaria)
    primaria: bool | None = None

    # Ubicación (solo lectura desde el panel — se derivan de la geom, ver plan)
    sectorId: int | None = None
    sectorNombre: str | None = None
    distritoId: int | None = None
    distritoNombre: str | None = None


class ElementoRedPatchIn(BaseModel):
    """Body de PATCH /red/elemento/{tipo}/{id}. Todos los campos opcionales — el
    service valida cuáles aplican según `tipo` con una whitelist. Al menos uno
    tiene que venir."""

    # Alcantarillado
    primaria: bool | None = None
    pendiente: float | None = None

    # Alcantarillado + Agua
    distancia: float | None = None
    materialId: int | None = None

    # Agua + Accesorios
    diametroPulgadas: float | None = None

    # Accesorios
    profundidad: float | None = None
    accesorioTipoId: int | None = None
    accesorioClasificacionId: int | None = None

    # Cajas
    cota: float | None = None

    # Buzones
    tapa: float | None = None
    fondo: float | None = None

    @model_validator(mode="after")
    def _al_menos_uno(self) -> "ElementoRedPatchIn":
        if not any(v is not None for v in self.model_dump().values()):
            raise ValueError("Debe enviar al menos un campo para actualizar")
        return self


class MaterialOut(BaseModel):
    id: int
    nombre: str


class AccesorioTipoOut(BaseModel):
    id: int
    nombre: str


class AccesorioClasificacionOut(BaseModel):
    id: int
    nombre: str
