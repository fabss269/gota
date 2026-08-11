from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.modules.auth.router import router as auth_router
from app.modules.catalogos.router import router as catalogos_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.dashboard_geo.router import router as dashboard_geo_router
from app.modules.grafo.router import router as grafo_router
from app.modules.incidencias.ingest_router import router as ingest_router
from app.modules.incidencias.router import router as incidencias_router
from app.modules.red.router import router as red_router
from app.modules.usuarios.router import router as usuarios_router

app = FastAPI(title="GOTA backend", version="0.1.0")

# Desarrollo local: Expo web corre en localhost con puerto variable (8081, 19006, 8082...).
# Producción: el frontend se sirve same-origin detrás de nginx (proxy /api), así que
# en teoría no necesitaría CORS — se deja ALLOWED_ORIGIN como red de seguridad para
# cuando el frontend se acceda por un dominio distinto al backend.
# Bearer token en header, no cookies, así que no hace falta allow_credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_origins=[settings.allowed_origin] if settings.allowed_origin else [],
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(catalogos_router)
app.include_router(incidencias_router)
app.include_router(ingest_router)
app.include_router(usuarios_router)
app.include_router(red_router)
app.include_router(dashboard_router)
app.include_router(dashboard_geo_router)
app.include_router(grafo_router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


# TEMPORAL — solo para el túnel público de demo (2026-08-05): Expo sirve
# map-style.json como estático sin cabecera CORS, y MapLibre lo pide desde un
# Worker (origen "null" para el navegador), así que se bloquea igual siendo
# mismo dominio. Se re-sirve acá porque este proceso ya tiene CORSMiddleware
# configurado. Asume que EPSEL-MOVIL vive al lado de este repo — no pensado
# para producción, quitar cuando se cierre el túnel de demo.
_MAP_STYLE_PATH = Path(__file__).resolve().parent.parent.parent / "EPSEL-MOVIL" / "public" / "map-style.json"


@app.get("/map-style.json", tags=["health"])
async def map_style() -> FileResponse:
    return FileResponse(_MAP_STYLE_PATH, media_type="application/json")
