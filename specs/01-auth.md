# 01 — Auth

Módulo: `modules/auth/`. Solo toca la BD propia (`usuario`, `rol`).

## `POST /auth/login`

- `PropiaAuthRepository.get_by_username_or_email(correo)` → `usuario` (join `rol` para
  `codigo`/`nombre` del rol).
- Verificación con `bcrypt` directo (no `passlib` — incompatible con `bcrypt>=4`, ver
  memoria del proyecto) contra `usuario.password_hash`.
- Si no existe o password no matchea → `CredencialesInvalidasError` (mensaje genérico,
  sin decir cuál campo falló — igual para ambos casos, por diseño de seguridad).
- `usuario.activo = false` → mismo error genérico (no revelar que la cuenta existe pero
  está desactivada).
- Éxito: genera `accessToken`/`refreshToken` (JWT, `core/security.py`), actualiza
  `usuario.ultimo_login = now()`.
- **Gap de mapeo con la respuesta de `API.md`**: el JSON de login trae `usuario.sector`
  (`"Sector 5"`), pero `usuario` ya no tiene `sector_id` (se descartó esa columna — ver
  spec 06). Ese campo del login response queda `null` por ahora, o se resuelve
  transitivamente igual que en `/usuarios` (última incidencia atendida por ese usuario →
  `suministro_codigo` → `sig`) — **a decidir antes de implementar**, probablemente no
  vale la pena ese costo solo para el payload de login.

## `POST /auth/refresh`

- Valida firma+expiración del `refreshToken`. Si expiró/inválido →
  `TokenExpiradoError` → 401 → la app fuerza logout (comportamiento ya definido en
  `API.md`).
- Reemite ambos tokens (rotación de refresh token, buena práctica estándar).

## `POST /auth/logout`

- Requiere `Authorization`. Invalidación server-side del refresh token: necesita una
  tabla/registro de tokens revocados o de sesiones activas — **no existe hoy en el
  esquema `gota`**. Como el propio `API.md` marca este endpoint como "opcional",
  la Fase 3 puede empezar sin invalidación real (el cliente simplemente descarta el
  token) y añadir una tabla `sesion_token` más adelante si se vuelve requisito real.

## Middleware / dependencia transversal

`shared/deps.py::get_current_user` — valida el `accessToken`, resuelve `usuario_id`,
lo inyecta en cualquier router que lo declare. `require_role(*codigos)` — dependencia
adicional para endpoints restringidos por rol (ej. reasignar responsable probablemente
solo para `supervisor`, a confirmar con el negocio antes de Fase 3).
