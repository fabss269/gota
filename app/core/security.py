from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings
from app.core.exceptions import TokenExpiradoError

_ALGORITHM = "HS256"


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def _create_token(usuario_id: str, expires_seconds: int, token_type: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": usuario_id,
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(seconds=expires_seconds),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def create_access_token(usuario_id: str) -> str:
    return _create_token(usuario_id, settings.jwt_access_expires_seconds, "access")


def create_refresh_token(usuario_id: str) -> str:
    return _create_token(usuario_id, settings.jwt_refresh_expires_seconds, "refresh")


def decode_token(token: str, expected_type: str) -> str:
    """Devuelve el usuario_id (`sub`). Cualquier fallo (firma, expiración, tipo
    incorrecto) se traduce a TokenExpiradoError, tal como pide API.md §9."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except JWTError as exc:
        raise TokenExpiradoError() from exc
    if payload.get("type") != expected_type:
        raise TokenExpiradoError()
    return payload["sub"]
