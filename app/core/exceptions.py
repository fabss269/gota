from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """Base de la jerarquía de errores de negocio — ver API.md §9."""

    status_code: int = 400
    code: str = "ERROR"
    default_message: str = "Ocurrió un error"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class CredencialesInvalidasError(DomainError):
    status_code = 401
    code = "CREDENCIALES_INVALIDAS"
    default_message = "Correo o contraseña incorrectos"


class TokenExpiradoError(DomainError):
    status_code = 401
    code = "TOKEN_EXPIRADO"
    default_message = "El token expiró o es inválido"


class ValidacionError(DomainError):
    status_code = 400
    code = "VALIDACION"
    default_message = "Error de validación"

    def __init__(self, message: str | None = None, campos: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.campos = campos or {}


class NoEncontradoError(DomainError):
    status_code = 404
    code = "NO_ENCONTRADO"
    default_message = "Recurso no encontrado"


class TransicionInvalidaError(DomainError):
    status_code = 409
    code = "TRANSICION_INVALIDA"
    default_message = "Transición de estado no permitida"


class PermisosInsuficientesError(DomainError):
    """No está en el modelo de errores fijo de API.md §9 (solo cubre auth/validación/
    404/409) — se agrega siguiendo la misma jerarquía porque `PATCH
    /incidencias/{id}/responsable` sí necesita restricción por rol (confirmado con
    Edgar). Formato de respuesta consistente con el resto: {"error": {code, message}}."""

    status_code = 403
    code = "PERMISOS_INSUFICIENTES"
    default_message = "No tienes permisos para realizar esta acción"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
        error_body: dict = {"code": exc.code, "message": exc.message}
        if isinstance(exc, ValidacionError) and exc.campos:
            error_body["campos"] = exc.campos
        return JSONResponse(status_code=exc.status_code, content={"error": error_body})
