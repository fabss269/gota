# gota-backend

Backend FastAPI para GOTA/EPSEL-MOVIL. Integra:

- **BD propia** (`vp_gota_create.ddl`) — incidentes, reclamos, usuarios, catálogos.
  Lectura/escritura. En dev local es una BD standalone (`gota`, tablas en `public`);
  en producción vive como esquema `gota` dentro de `bd_conhydra` (ver `PROPIA_DB_SCHEMA`).
- **`sig`** en `bd_conhydra` — catastro/red de agua y desagüe de EPSEL. Solo lectura.
  Conexión directa por IP LAN (`172.16.5.222:5432`) en producción (servidor dentro de
  la red de EPSEL); dev local remoto puede seguir usando un túnel SSH si no está en
  esa red — solo cambian `SIG_DB_HOST`/`SIG_DB_PORT`, no el código.

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

## Despliegue (producción)

`deploy/docker-compose.yml` levanta `frontend` (nginx + build de EPSEL-MOVIL, único
puerto publicado), `backend`, `martin` y `redis` en una sola red docker (`gota`) — la
BD (`bd_conhydra`, esquemas `gota`+`sig`) es **externa**, no hay contenedor `postgres`
propio. Ver `deploy/.env.example` para las variables reales.

**Antes del primer deploy**, aplicar el esquema `gota` una sola vez contra la BD de
producción (confirmar antes que no exista ya, para no pisar nada):
```bash
psql -h 172.16.5.222 -U postgres -d bd_conhydra -c "\dn"
psql -h 172.16.5.222 -U postgres -d bd_conhydra -f vp_gota_create.ddl
```

Pendiente (no resuelto en este cambio, ver plan de la sesión que lo introdujo):
crear roles de Postgres dedicados (uno dueño de `gota`, uno de solo lectura para
`sig`) en vez de usar el superusuario `postgres` para el servicio real; TLS/HTTPS
delante de nginx; migrar la BD OLAP (datamart, DDL en
`~/Documentos/epsel_gota_datamart_star_schema.sql`) a producción como base de datos
separada en el mismo servicio Postgres.
