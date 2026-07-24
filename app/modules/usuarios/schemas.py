from pydantic import BaseModel


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    rol: str
    # `cuadrilla` se quita del schema de respuesta (specs/06) — EPSEL ya no asigna por
    # cuadrilla, ahora asigna área + usuario a una incidencia.
    sector: str | None = None
