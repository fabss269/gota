from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    correo: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    rol: str
    # `sector` queda null por ahora: usuario ya no tiene sector_id (ver specs/06),
    # y resolverlo transitivamente en cada login no vale el costo solo para este campo.
    sector: str | None = None
    avatarUrl: str | None = None


class LoginResponse(BaseModel):
    accessToken: str
    refreshToken: str
    expiresIn: int
    usuario: UsuarioOut
