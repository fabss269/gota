# Colección Postman — gota-backend

`gota-backend.postman_collection.json` — los 18 endpoints de `API.md` + `/health`,
verificada end-to-end con `newman` contra el servidor local.

## Uso

1. Levantar el servidor (ver `README.md` del repo): Postgres local + Redis (`gota-redis`)
   + `uv run uvicorn app.main:app --reload` (puerto 8000 por defecto, coincide con la
   variable `baseUrl` de la colección).
2. Sembrar datos de prueba si no lo hiciste: `.venv/bin/python -m scripts.seed_dev`.
3. En Postman: **Import** → seleccionar `gota-backend.postman_collection.json`.
4. Correr **Auth → Login (técnico)** y **Auth → Login (supervisor)** primero — cada uno
   guarda su token en las variables de colección (`accessToken`, `supervisorAccessToken`)
   automáticamente vía script de test. El resto de requests ya heredan `accessToken`
   salvo "Reasignar responsable (supervisor)", que usa `supervisorAccessToken`
   explícitamente (requiere rol `supervisor`).

## Notas

- Las requests con nombre `(→ 4xx)` prueban casos de error a propósito (credenciales
  inválidas, 404, 403 sin permiso, 400 de validación) — el código de estado esperado no
  es un fallo.
- `Incidencias → Cambiar estado` y `→ Registrar avance` mutan el estado real de
  `{{incidenciaCodigo}}` (`EPS-00001` por defecto) en la BD — `scripts/seed_dev.py` no
  resetea incidentes que ya existen, así que si corrés la colección más de una vez
  algunos pasos pueden devolver `409 TRANSICION_INVALIDA` (correcto: la transición ya no
  es válida desde el nuevo estado actual, no un bug). Revisar
  `Transiciones válidas` antes de ajustar el body si eso pasa.
- Variables editables en la colección: `incidenciaCodigo`, `tecnicoId`, `areaId`,
  `distritoIdChiclayo`, `sectorIdAgua`, `sectorIdDesague` — ya vienen con valores reales
  de `scripts/seed_dev.py`.

## Correr sin abrir Postman (CLI)

```bash
npx newman run postman/gota-backend.postman_collection.json
```
