# Despliegue actual: máquina local de Edgar + túnel Cloudflare (2026-08-07)

Este es el despliegue que **realmente se está usando ahora** para probar contra
`kasqan.com`. Reemplaza en la práctica a los otros dos documentos de este mismo
directorio (`PRODUCTION_DEPLOY.md`, pensado para un servidor Linux por SSH, y
`WINDOWS_RUNNER_SETUP.md`, para un Windows Server con self-hosted runner) — ninguno
de esos dos está en uso hoy. Se dejan sin borrar por si se retoma alguno más
adelante, pero **no son la fuente de verdad actual**.

## Topología

No hay servidor remoto. Todo corre en la máquina local de Edgar, expuesto a
internet con un túnel de Cloudflare:

```
Internet
  │
  ├─ gota.kasqan.com        ──► cloudflared ──► localhost:8081  (Expo web dev server)
  ├─ api-gota.kasqan.com    ──► cloudflared ──► localhost:8123  (uvicorn, gota-backend)
  └─ tiles-gota.kasqan.com  ──► cloudflared ──► localhost:3000  (Martin, Docker)
```

Config del túnel: `~/.cloudflared/gota-dev-config.yml` (tunnel id
`47ff9d4b-1763-484a-aae6-af6c228b48f1`). Arrancarlo:

```bash
cloudflared tunnel --config ~/.cloudflared/gota-dev-config.yml run
```

No se arranca solo — hay que correrlo a mano (o dejarlo en una sesión aparte) cada
vez que se quiera probar contra los dominios `kasqan.com`. Nada lo supervisa ni lo
reinicia si se cae.

## Base de datos: una sola, con datos reales de Fabiana

`bd_conhydra_local` (Postgres 16 local, puerto 5432) es la única base — contiene
los schemas `gota` (BD propia) y `sig` (catastro) **juntos**, igual que en
producción real. Esto es lo que espera `app/core/config.py` (`DB_HOST`/`DB_USER`/
`DB_PASSWORD`/`DB_NAME` unificados, sin `PROPIA_DB_URL`/`SIG_DB_*` separados).

Fuente de los datos: un backup real (`pg_dump -Fc`) que arma Fabiana con datos de
producción + sus funciones de datamart/dashboard (`gota.mv_incidente_enriquecido`,
etc.). El de esta sesión: `~/Documentos/bd_conhydra_2026-08-07.backup` (207 MB,
703 objetos, PostGIS 3.4.2, Postgres 16.13).

**Restaurar un backup nuevo de Fabiana, desde cero:**

```bash
export PGPASSWORD=<la de .env>

# 1. Cortar todo lo que tenga conexiones abiertas a la BD vieja
kill $(pgrep -f "uvicorn app.main:app --port 8123")
docker stop gota-martin

# 2. Recrear la base vacía
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='bd_conhydra_local' AND pid <> pg_backend_pid();"
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS bd_conhydra_local;"
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE bd_conhydra_local;"

# 3. Restaurar (custom format, ~5-10 min con -j 4)
pg_restore -h 127.0.0.1 -p 5432 -U postgres -d bd_conhydra_local \
  --no-owner --no-privileges -j 4 <ruta-al-.backup>
```

**Después de restaurar, SIEMPRE correr estos dos fixes** (el backup de Fabiana no
los trae — son cosas que este repo necesita encima de su dump):

```bash
psql -h 127.0.0.1 -p 5432 -U postgres -d bd_conhydra_local -f sql/martin_vistas_2d.sql
psql -h 127.0.0.1 -p 5432 -U postgres -d bd_conhydra_local -f sql/fixes_post_restore_backup_fabiana.sql
```

- `martin_vistas_2d.sql`: recrea `gota.agua_2d`/`alcantarillado_2d` con
  `ST_Force2D` (Martin no tolera la Z en algunos tramos) **y con `diametro`**
  incluido (necesario para el grosor de línea por diámetro en el mapa — el dump de
  Fabiana trae estas vistas, pero sin esa columna).
- `fixes_post_restore_backup_fabiana.sql`: corrige `sig.sectores.sectorid=35`
  (estaba mal etiquetado como Pimentel, es Chiclayo) — dato sucio puntual de este
  backup, no una migración de schema.

**Ya NO hace falta reconstruir la caché Redis después de un restore** (decisión
de Edgar 2026-08-10, revierte lo que decía esta sección antes). `GET
/incidencias` filtra `estado`/`sector`/`distrito` directo contra Postgres/`sig`
— Redis quedó solo como caché de lectura individual (`cache:incidente:{id}:
resumen`, se llena sola incidente por incidente al leerse, como cualquier
caché), ya no hay índices invertidos (`idx:estado:*`/`idx:sector:*`/
`idx:prioridad:*`) que dependieran de un rebuild manual. Un restore de BD deja
Redis con claves huérfanas apuntando a UUIDs que ya no existen, pero eso ya no
rompe nada — simplemente son cache misses que se recalculan solos en la
próxima lectura de cada incidente; si molesta tener basura vieja dando vueltas,
`docker exec gota-redis redis-cli FLUSHALL` alcanza, no hace falta el script.

`scripts/rebuild_incidencia_cache.py` sigue existiendo pero es opcional —
`poblar_cache_incidentes` la sigue usando `dana_ingest.py` para precargar el
resumen de incidentes recién ingeridos (ese sí es un caso legítimo de "poblar
antes de que alguien lea"), y el CLI completo (`python -m
scripts.rebuild_incidencia_cache`) sirve como warm-up manual si algún día se
quiere evitar el costo de los primeros cache-miss, pero no es necesario para
que nada funcione.

**Verificado compatible con este backup (2026-08-07)**, sin perder funcionalidad
propia — análisis completo hecho antes de restaurar, comparando el schema del
backup contra todo lo que usa el código de este repo:
- Las 14 funciones de `gota.simular_*`/`simular_*_red`/`detectar_focos_activos_*`
  (módulo `grafo`, simulación del mapa) están presentes con las mismas firmas y
  las mismas columnas de retorno que espera `app/modules/grafo/repository.py`.
- Todas las tablas de `sig` que toca este repo (`agua`, `alcantarillado`,
  `cajaagua`, `cajadesague`, `buzones`, `accesorios`, `manzanas`, `lotes`,
  `sectores`, `distritos`, `materiales`, `aguatipos`, `alcantarilladotipos`,
  `accesoriotipos`) tienen exactamente las columnas que el código espera.
- `gota.usuario`/`gota.rol` calzan con el ORM (`app/db/models_propia.py`) —
  los usuarios de prueba de siempre (`tecnico@epsel.gob.pe` / `epsel2026`,
  `supervisor@epsel.gob.pe` / `epsel2026`) siguen activos y con el mismo hash.

**Gap real, ya sin impacto**: `gota.incidente.codigo` en este backup tiene un
CHECK de 5 dígitos exactos (`^[0-9]{5}$`), y `gota.reclamo` exige varias columnas
`NOT NULL` sin default (`parentesco_id`, `distrito`, `alcance_id`,
`medio_recepcion_id`) que nuestro ORM no rellena. Esto **rompería** cualquier
INSERT nuestro a esas tablas — pero el único camino de escritura que existía
(`app/modules/incidencias/ingest_router.py` + `dana_ingest.py`, el mock de DANA)
**ya no se usa** (decisión de Edgar 2026-08-07: el registro de incidencias nuevas
ya no pasa por ahí). Si algún día se reactiva ese ingest, hay que revisar el
formato de `codigo` y completar esas columnas antes.

## Martin (tiles)

Contenedor Docker `gota-martin`, ya configurado apuntando a `bd_conhydra_local`
vía `host.docker.internal`. Config: `deploy/martin-config.yaml` (gitignored,
renderizado a mano desde `deploy/martin-config.template.yaml` — no hace falta
`envsubst` en local, la connection string ya está resuelta directamente en el
archivo). Si se edita el `.template.yaml`, hay que reflejar el cambio a mano en
`martin-config.yaml` y reiniciar:

```bash
docker restart gota-martin
```

Si el contenedor no existe (primera vez, o hubo que recrearlo), el comando
completo es:

```bash
docker run -d --name gota-martin \
  -p 3000:3000 \
  -v /home/ivaned/gota-backend/deploy/martin-config.yaml:/config.yaml:ro \
  --add-host=host.docker.internal:host-gateway \
  --restart unless-stopped \
  ghcr.io/maplibre/martin:latest \
  --config /config.yaml --listen-addresses 0.0.0.0:3000 --cache-expiry 60s
```

Dos flags NO son opcionales, aunque no estén en `martin-config.yaml`:

- `--add-host=host.docker.internal:host-gateway`: Docker Engine en Linux (a
  diferencia de Docker Desktop) no resuelve `host.docker.internal` por
  defecto. Sin esto Martin no conecta a Postgres (error confirmado en vivo
  2026-08-07: `failed to lookup address information: Name or service not
  known`).
- `--cache-expiry 60s`: Martin cachea tiles en memoria SIN invalidación ligada
  a cambios de datos. Confirmado en vivo con curl (mismo `etag`/bytes antes y
  después de un `UPDATE sig.agua SET diametro=...`): un edit de
  diámetro/material vía `PATCH /red/elemento/{tipo}/{id}` cambia la BD
  correctamente pero la etiqueta/grosor en el mapa no se actualiza hasta que
  el tile expira o el contenedor reinicia. `cache_expiry`/`cache_idle_timeout`
  NO son keys válidas del YAML (confirmado con
  `docker exec gota-martin martin --config /config.yaml --save-config -`, que
  loguea `"Ignoring unrecognized configuration key 'cache_expiry'"`) — solo
  existen como flags de CLI, van en el comando del contenedor.

El `docker-compose.yml` de este mismo directorio ya trae ambos flags para el
servicio `martin` (deploy remoto vía compose), pero el setup local actual usa
un contenedor `docker run` suelto, no compose — de ahí que este runbook
documente el comando explícito.

`gota-redis` (Docker) también debe estar arriba — caché externa de
sector/prioridad/estado (`specs/00-arquitectura.md` §7).

## Backend

```bash
cd ~/gota-backend
.venv/bin/uvicorn app.main:app --port 8123 --reload
```

`.env` local ya apunta todo a `bd_conhydra_local` (ver arriba). `ALLOWED_ORIGIN`
está en `https://gota.kasqan.com` pero el CORS real permite cualquier
`http://localhost:*` también (`app/main.py`), así que probar contra
`localhost:8081` funciona sin tocar nada.

## Frontend (Expo web)

```bash
cd ~/EPSEL-MOVIL
npx expo start --web --port 8081
```

Usa `.env.local` (gitignored, no pisa el `.env` real) para apuntar a los
servicios locales en vez del túnel:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8123
EXPO_PUBLIC_MAP_STYLE_URL=http://localhost:8081/map-style.json
```

Si `node_modules/` se reinstala (`npm install` después de traer cambios de
`package.json`), **siempre correr una instalación limpia**
(`rm -rf node_modules && npm install`) — un `npm install` incremental puede
reaplicar el patch de `patches/react-native-web+0.21.2.patch` sobre un archivo ya
parcheado y duplicar declaraciones (`codegenNativeComponent already declared`),
rompiendo el bundle de Metro.

## CI/CD

`.github/workflows/ci.yml` y `deploy.yml` se **quitaron** de ambos repos
(2026-08-07) — el runner self-hosted de Windows de `WINDOWS_RUNNER_SETUP.md`
nunca se terminó de configurar, así que un push a `main` dejaba el job de deploy
colgado. Mientras se use este despliegue local+túnel, no hace falta CI/CD: no hay
build de imagen ni push a GHCR, todo corre directo desde el checkout local.

## Verificación end-to-end

1. `curl http://127.0.0.1:8123/health` → `{"status":"ok"}`.
2. `curl http://127.0.0.1:3000/agua` → JSON con `diametro` en `vector_layers[0].fields`.
3. Login: `POST /auth/login` con `tecnico@epsel.gob.pe` / `epsel2026`.
4. `GET /red/elemento/tuberia/{aguaid}` (con token) → material/tipo/sector legibles,
   no solo ids.
5. `POST /grafo/simulacion` con un `aguaid` real → lista de `afectados` no vacía.
6. Con el túnel arriba: abrir `https://gota.kasqan.com`, loguear, activar capa
   "Agua", hacer zoom — el grosor de línea debe variar por diámetro y debe
   aparecer la etiqueta en pulgadas al acercarse.

## Pendiente / no resuelto en esta sesión

- El túnel `ssh.kasqan.com:15432` hacia el `bd_conhydra` remoto real (el que usa
  el servidor de prueba de `PRODUCTION_DEPLOY.md`) seguía caído — no afecta este
  despliegue local (usa su propio Postgres local, no ese túnel), pero si se
  retoma el servidor de `ssh.kasqan.com:2222`, ese túnel sigue siendo su
  dependencia externa de siempre.
- El `docker-compose.yml`/`.env` de `ssh.kasqan.com:2222` quedaron con la imagen
  de backend vieja fijada a propósito (ver commits de esta fecha) porque el
  `main` actual ya no es compatible con su esquema de variables viejo
  (`PROPIA_DB_URL`/`SIG_DB_*`) ni con su Postgres local (solo tiene `gota`, no
  `sig`) — no se tocó más allá de estabilizarlo.
