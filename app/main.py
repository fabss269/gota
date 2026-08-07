from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.scheduler import detener_scheduler, iniciar_scheduler
from app.modules.auth.router import router as auth_router
from app.modules.catalogos.router import router as catalogos_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.grafo.router import router as grafo_router
from app.modules.incidencias.ingest_router import router as ingest_router
from app.modules.incidencias.router import router as incidencias_router
from app.modules.red.router import router as red_router
from app.modules.usuarios.router import router as usuarios_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    #iniciar_scheduler()
    yield
    #detener_scheduler()


app = FastAPI(title="GOTA backend", version="0.1.0", lifespan=lifespan)

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
app.include_router(grafo_router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
