# Guía de implementación en producción — VPS Contabo (Linux)

Checklist en orden — cada paso se hace **una sola vez** salvo que se indique lo
contrario. Asume un VPS Linux limpio (Contabo, 8GB+ RAM), acceso por SSH.

**Respuesta corta a "¿hago pull y `docker compose up` a mano?":** no, ese es
exactamente el trabajo que hace el self-hosted runner automáticamente cuando
hagas `git push` a `main`. Los repos **nunca se clonan a mano en el VPS** — ni
siquiera EPSEL-MOVIL entra como código ahí, solo como imagen ya construida
(`ghcr.io/ivanedac/epsel-movil`) referenciada en el compose. Lo único manual es
la preparación de la máquina (pasos 1-3), migrar los datos (paso 4) y el DNS/
TLS (paso 8). Después de eso, el flujo normal es simplemente "push a `main`".

Desde 2026-08-10 la BD (Postgres+PostGIS, esquemas `gota` y `sig`) **ya no es
externa** — es un servicio más del mismo `docker-compose.yml` (`postgres`,
imagen `postgis/postgis:16-3.4-alpine`), vive en el propio VPS. Esto reemplaza
el diseño anterior (BD en un servidor EPSEL aparte, `172.16.5.222`) — ya no
depende de conectividad de red hacia otro servidor para funcionar.

## 1. Preparar el VPS

Por SSH, en el VPS:
```bash
# Docker Engine + compose plugin (Ubuntu/Debian; ver docs.docker.com/engine/install si es otra distro)
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin gettext-base

# Usuario no-root para el deploy, con permiso de hablar con Docker
sudo usermod -aG docker "$USER"
# cerrar sesión SSH y volver a entrar para que el grupo tome efecto
```
`gettext-base` trae `envsubst`, que el workflow de deploy usa para renderizar
`martin-config.yaml` desde el template (Martin no soporta `${VAR}` directo en
su propio config, ver comentario en `martin-config.template.yaml`).

## 2. Carpeta de deploy persistente + `.env` real

```bash
sudo mkdir -p /opt/epsel-deploy
sudo chown "$USER":"$USER" /opt/epsel-deploy
```

Crear ahí `/opt/epsel-deploy/.env` a mano, basado en `deploy/.env.example` de
este repo, con **credenciales generadas de cero para este VPS**
(`DB_PASSWORD`, `JWT_SECRET` — `openssl rand -hex 32` para cada una). **Nunca
por git** — este archivo vive solo en disco, en esta carpeta. No reusar
ningún valor que haya estado antes en `.env.example` (quedó una contraseña
real expuesta en el historial del repo, ver comentario ahí).

## 3. Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # nginx (frontend) — único puerto que necesita el stack
sudo ufw allow 443/tcp   # si se termina TLS en el propio VPS (paso 8, opción B)
sudo ufw enable
```
Backend/Martin/Redis/Postgres no publican puerto propio — todo el tráfico
externo pasa por nginx (servicio `frontend`), no hace falta abrir nada más.

## 4. Self-hosted runners

Seguir [`LINUX_RUNNER_SETUP.md`](./LINUX_RUNNER_SETUP.md) completo: registrar
los dos runners (`epsel-backend`, `epsel-movil`) como servicio `systemd`, y
configurar la repo variable `DEPLOY_PATH=/opt/epsel-deploy` en **ambos** repos
de GitHub (Settings → Secrets and variables → Actions → Variables).

## 5. Primer deploy de gota-backend — levanta postgres/backend/martin/redis

Push/merge a `main` en **gota-backend**. GitHub Actions: build+push de la
imagen a GHCR (nube) → el runner self-hosted copia
`docker-compose.yml`/`martin-config.template.yaml` a `/opt/epsel-deploy`,
renderiza `martin-config.yaml` con `envsubst`, y corre `docker compose pull` +
`docker compose up -d --remove-orphans`.

Esto deja arriba `postgres`, `backend`, `martin`, `redis` (el servicio
`frontend` puede fallar si `ghcr.io/ivanedac/epsel-movil` todavía no existe en
GHCR — no bloquea al resto, se resuelve en el paso 7). `postgres` arranca con
una base **vacía** — el paso 6 la llena con los datos reales.

## 6. Migrar los datos reales

Desde la máquina que tenga el backup/BD actual más reciente (ej. la BD local
de desarrollo, `bd_conhydra_local`, ya verificada y funcionando):

```bash
# En el origen: dump completo (gota + sig)
pg_dump -h <host-origen> -U postgres -d bd_conhydra_local -Fc -f bd_conhydra_migracion.dump

# Transferir al VPS
scp bd_conhydra_migracion.dump usuario@<ip-vps>:/tmp/

# En el VPS: restaurar dentro del contenedor postgres
docker cp /tmp/bd_conhydra_migracion.dump gota-postgres:/tmp/dump.bin
docker exec gota-postgres pg_restore -U postgres -d bd_conhydra --no-owner --no-privileges -j 4 /tmp/dump.bin
```
(`bd_conhydra` es el nombre que ya trae `POSTGRES_DB` en el `.env` del paso 2
— si se usó otro nombre, ajustar acá y en `DB_NAME` consistentemente.)

Después del restore, correr los fixes de siempre (ver
[`DESPLIEGUE_LOCAL_TUNEL.md`](./DESPLIEGUE_LOCAL_TUNEL.md) — mismos dos
scripts SQL, `martin_vistas_2d.sql` y `fixes_post_restore_backup_fabiana.sql`,
si el dump viene de un backup de Fabiana) y reiniciar Martin para que tome
los datos: `docker compose restart martin`.

## 7. Deploy de EPSEL-MOVIL — trae el frontend

Push/merge a `main` en **EPSEL-MOVIL**. Build+push de su imagen → el runner de
ese repo hace `docker compose pull frontend` + `docker compose up -d --no-deps
frontend`. Recién acá queda expuesto el único puerto público (80).

Si se prefiere no esperar a tener ambos runners listos, existe un camino
manual de bootstrap (una sola vez, para validar que todo funciona antes de
confiar en CI): copiar a mano los archivos de `deploy/` a `/opt/epsel-deploy`,
correr `envsubst < martin-config.template.yaml > martin-config.yaml`, y
`docker compose pull && docker compose up -d` directamente por SSH. Pero el
objetivo es que esto no haga falta de nuevo — una vez configurado el paso 4,
cada `git push` a `main` lo hace solo.

## 8. DNS + TLS

Apuntar un hostname (ej. seguir usando `gota.kasqan.com`) a la IP pública del
VPS en Cloudflare, tipo A, **proxy activado** (nube naranja) — un solo
hostname alcanza, nginx ya consolida `/api`, `/tiles` y la SPA detrás de un
origen (a diferencia del túnel local, que usaba 3 subdominios porque en dev
son 3 procesos sueltos).

Dos opciones para el tramo Cloudflare↔VPS:
- **Opción A — Flexible** (más simple, cero configuración en el VPS): el
  tráfico Cloudflare↔VPS va en HTTP plano por dentro de su red. Suficiente
  para arrancar rápido.
- **Opción B — Full (strict)**, recomendado: generar un **Origin Certificate**
  gratis desde el dashboard de Cloudflare (SSL/TLS → Origin Server → Create
  Certificate), instalarlo en nginx (agregar `listen 443 ssl;` +
  `ssl_certificate`/`ssl_certificate_key` a `nginx.conf` de EPSEL-MOVIL, abrir
  443 en `ufw` — ya contemplado en el paso 3) y activar modo Full (strict) en
  Cloudflare. Evita tráfico sin cifrar entre el edge de Cloudflare y el VPS.

## 9. Verificación end-to-end

```bash
cd /opt/epsel-deploy
docker compose ps        # postgres, backend, martin, redis, frontend: los 5 "Up"/"healthy"
docker compose logs backend --tail 50
```
- `https://<tu-hostname>/` → carga la SPA.
- Login real (`/api/auth/login` vía el proxy de nginx) con un usuario del
  esquema `gota` migrado en el paso 6.
- `https://<tu-hostname>/tiles/agua/0/0/0` → responde (aunque el mapa en sí
  necesita `public/map-style.production.json`, ya apuntando a `/tiles/...`).
- `GET /api/incidencias` trae los incidentes reales migrados, no una lista
  vacía.

## 10. Steady state — de ahora en adelante

Ya no hace falta tocar el VPS a mano: `git push` a `main` en cualquiera de los
dos repos dispara su propio build+deploy. Los únicos casos que vuelven a
requerir SSH:
- Cambios al **esquema** `gota` (nuevas tablas/columnas) — no se aplican solos
  desde este flujo, hay que aplicar el diff a mano (`ALTER TABLE ...`) contra
  el `postgres` del VPS cuando cambie.
- Rotar `.env` (nuevas credenciales/secrets) — se edita directo en
  `/opt/epsel-deploy/.env`, no vive en git.
- Actualizar `martin-config.template.yaml` con tablas/columnas nuevas — el
  siguiente deploy de gota-backend lo re-renderiza solo.

## 11. Backup periódico

A diferencia del plan anterior (BD externa, "no es tuya, no dumpear todo
`sig`"), ahora el `postgres` del VPS es propio — el backup es de la base
completa:

```bash
# Cron diario, ej. en /etc/cron.d/epsel-backup
0 3 * * * root docker exec gota-postgres pg_dump -U postgres -Fc bd_conhydra > /opt/epsel-backups/bd_conhydra_$(date +\%Y\%m\%d).dump
```
Con rotación simple (`find /opt/epsel-backups -mtime +14 -delete` para
quedarse con ~2 semanas). Copiar estos dumps fuera del VPS de vez en cuando
(no solo en el mismo disco) para que un backup sirva si el VPS entero falla.

## Pendientes conocidos (no bloquean el deploy, pero sí producción "real")

- Roles de Postgres dedicados en vez del superusuario `postgres` (hoy ambas
  conexiones, propia y `sig`, usan el mismo superuser).
- TLS/HTTPS delante de nginx si se elige la Opción A del paso 8 en vez de la B.
- Migrar la BD OLAP (datamart, DDL en
  `~/Documentos/epsel_gota_datamart_star_schema.sql`) a producción como base de
  datos separada en el mismo servicio Postgres — no se toca en este flujo.
