# gota-backend

Backend FastAPI para GOTA/EPSEL-MOVIL. Integra:

- **BD propia** (`vp_gota_create.ddl`) — incidentes, reclamos, usuarios, catálogos.
  Lectura/escritura.
- **`sig`** en `bd_conhydra` — catastro/red de agua y desagüe de EPSEL, vía túnel SSH
  (`ssh.kasqan.com:15432`). Solo lectura.

Contrato a satisfacer: [`API.md`](./API.md). Diseño técnico spec-driven en
[`specs/`](./specs/) — leer `specs/00-arquitectura.md` primero, documenta las
decisiones transversales (dos motores de BD, sin JOIN cross-DB, patrón
router/service/repository por módulo) de las que dependen los demás specs.

## Estado

Fase 3 (implementación) completa para los 6 módulos del contrato de `API.md`: `auth`,
`catalogos`, `incidencias`, `usuarios`, `red`, `dashboard` — 18 endpoints, verificados
end-to-end contra Postgres local + `sig` real (túnel SSH) + Redis. Detalle de decisiones
tomadas al implementar en la sección "Estado de implementación" de cada `specs/0N-*.md`
y en `API.md` §10 (cambios de contrato). `vp_gota_create.ddl` sigue siendo el DDL que
edita Edgar externamente — confirmar que el local coincide con la última versión acordada
antes de tocar modelos/migraciones.

Gaps reales de datos encontrados (no son bugs de este código, ver specs para detalle):
`sig.alcantarillado` no tiene columna de diámetro (spec 04), `sig.accesoriotipos` no
distingue válvulas/hidrantes (spec 07), módulo de alertas no implementado por lo que
`prioridad` usa un default (spec 03).

## Cómo correr

```bash
cp .env.example .env   # completar credenciales reales
pip install -e ".[dev]"
# Redis (si no hay uno corriendo ya):
docker run -d --name gota-redis -p 6379:6379 --restart unless-stopped redis:7-alpine
# Seed de datos de desarrollo (opcional, usa suministro_codigo reales de sig):
.venv/bin/python -m scripts.seed_dev
uvicorn app.main:app --reload
```

Si Redis se vacía o se pierde, reconstruir la caché de incidencias con:
```bash
.venv/bin/python -m scripts.rebuild_incidencia_cache
```
