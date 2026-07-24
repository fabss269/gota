from fastapi import FastAPI

from app.core.exceptions import register_exception_handlers
from app.modules.auth.router import router as auth_router
from app.modules.catalogos.router import router as catalogos_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.incidencias.router import router as incidencias_router
from app.modules.red.router import router as red_router
from app.modules.usuarios.router import router as usuarios_router

app = FastAPI(title="GOTA backend", version="0.1.0")

register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(catalogos_router)
app.include_router(incidencias_router)
app.include_router(usuarios_router)
app.include_router(red_router)
app.include_router(dashboard_router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
