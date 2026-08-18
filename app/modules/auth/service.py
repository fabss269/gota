from app.core.config import settings
from app.core.exceptions import CredencialesInvalidasError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.models_propia import Usuario
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import LoginResponse, UsuarioOut


class AuthService:
    def __init__(self, repository: AuthRepository) -> None:
        self._repository = repository

    async def login(self, correo: str, password: str) -> LoginResponse:
        usuario = await self._repository.get_by_correo_o_username(correo)

        # Mensaje genérico sin importar cuál validación falló (correo inexistente,
        # password incorrecta, cuenta desactivada) — así lo pide API.md §1.
        if usuario is None or not usuario.activo or not verify_password(password, usuario.password_hash):
            raise CredencialesInvalidasError()

        await self._repository.marcar_ultimo_login(usuario)
        return self._build_login_response(usuario)

    async def refresh(self, refresh_token: str) -> LoginResponse:
        usuario_id = decode_token(refresh_token, expected_type="refresh")
        usuario = await self._repository.get_by_id(usuario_id)
        if usuario is None or not usuario.activo:
            raise CredencialesInvalidasError()
        return self._build_login_response(usuario)

    def _build_login_response(self, usuario: Usuario) -> LoginResponse:
        return LoginResponse(
            accessToken=create_access_token(str(usuario.usuario_id)),
            refreshToken=create_refresh_token(str(usuario.usuario_id)),
            expiresIn=settings.jwt_access_expires_seconds,
            usuario=UsuarioOut(
                id=str(usuario.usuario_id),
                nombre=f"{usuario.nombres} {usuario.apellidos}",
                rol=usuario.rol.codigo,
                avatarUrl=usuario.avatarurl,
            ),
        )
