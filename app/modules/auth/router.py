from fastapi import APIRouter, Response, status

from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import LoginRequest, LoginResponse, RefreshRequest
from app.modules.auth.service import AuthService
from app.shared.deps import CurrentUser, PropiaSession

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_service(session: PropiaSession) -> AuthService:
    return AuthService(AuthRepository(session))


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, session: PropiaSession) -> LoginResponse:
    return await _get_service(session).login(body.correo, body.password)


@router.post("/refresh", response_model=LoginResponse)
async def refresh(body: RefreshRequest, session: PropiaSession) -> LoginResponse:
    return await _get_service(session).refresh(body.refreshToken)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(usuario: CurrentUser) -> Response:
    # Invalidación server-side del refresh token: API.md lo marca opcional y no hay
    # tabla de sesiones/tokens revocados todavía (ver specs/01-auth.md) — el cliente
    # descarta el token, el backend solo valida que la sesión sea válida al momento
    # de llamar este endpoint.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
