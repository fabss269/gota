# Guía de implementación en producción

Checklist en orden — cada paso se hace **una sola vez** salvo que se indique lo
contrario. Asume el Windows Server de EPSEL, con Docker ya corriendo contenedores
Linux (WSL2), acceso solo por RDP (sin SSH).

**Respuesta corta a "¿hago pull y `docker compose up` a mano?":** no, ese es
exactamente el trabajo que hace el self-hosted runner automáticamente cuando
hagas `git push` a `main`. Los repos **nunca se clonan a mano en el servidor** —
ni siquiera EPSEL-MOVIL entra como código ahí, solo como imagen ya construida
(`ghcr.io/ivanedac/epsel-movil`) referenciada en el compose. Lo único manual es
la preparación de la máquina (pasos 1-4) y aplicar el DDL una vez (paso 6,
justo después del primer deploy). Después de eso, el flujo normal es
simplemente "push a `main`".

## 1. Confirmar Docker (ya hecho, solo para referencia)

Docker en ese servidor ya corre contenedores Linux vía WSL2 — confirmado. Si en
algún momento hay que re-verificarlo: `docker info` → `OSType: linux`.

## 2. Carpeta de deploy persistente + `.env` real

Por RDP, en el servidor:
```powershell
New-Item -ItemType Directory -Force -Path C:\epsel-deploy
```
Crear ahí `C:\epsel-deploy\.env` a mano, basado en `deploy/.env.example` de este
repo, con los valores reales de producción (`DB_PASSWORD`, `JWT_SECRET`,
`DB_HOST`/`SIG_DATABASE_URL` apuntando a `172.16.5.222`,
`PROPIA_DB_SCHEMA=gota`, `FRONTEND_PORT`, etc.). **Nunca por git** — este archivo
vive solo en disco, en esta carpeta.

## 3. Firewall de Windows

Docker puede publicar el puerto del frontend sin problema y aun así quedar
inalcanzable desde afuera si Windows Defender Firewall no tiene una regla de
entrada — es un bloqueo silencioso típico en Windows Server, fácil de pasar
por alto porque `docker compose ps` va a mostrar todo "Up" igual.
```powershell
New-NetFirewallRule -DisplayName "GOTA Frontend" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```
(Ajustar `80` si `FRONTEND_PORT` en el `.env` es otro puerto. Solo este puerto
necesita regla — backend/martin/redis no publican puerto propio, no hace falta
abrir nada más.)

## 4. Verificar que `bd_conhydra` es alcanzable desde el servidor

Antes de configurar nada más — si esto falla, ningún paso siguiente va a
funcionar, mejor resolver conectividad de red (firewall, VLAN, etc.) primero:
```powershell
docker run --rm -e PGPASSWORD=<password> postgres:16-alpine `
  psql -h 172.16.5.222 -U postgres -d bd_conhydra -c "select 1;"
```

## 5. Self-hosted runners (uno por repo)

Seguir [`WINDOWS_RUNNER_SETUP.md`](./WINDOWS_RUNNER_SETUP.md) completo: registrar
los dos runners (`epsel-backend`, `epsel-movil`) como servicio de Windows, y
configurar la repo variable `DEPLOY_PATH=C:\epsel-deploy` en **ambos** repos de
GitHub (Settings → Secrets and variables → Actions → Variables).

## 6. Primer deploy de gota-backend — levanta backend/martin/redis

Push/merge a `main` en **gota-backend**. GitHub Actions: build+push de la
imagen a GHCR (nube) → el runner self-hosted copia
`docker-compose.yml`/`martin-config.template.yaml`/`render-martin-config.ps1`
a `C:\epsel-deploy` y corre `docker compose pull` +
`docker compose up -d --remove-orphans`.

Esto deja arriba `backend`, `martin`, `redis` (el servicio `frontend` puede
fallar si `ghcr.io/ivanedac/epsel-movil` todavía no existe en GHCR — no bloquea
al resto, se resuelve en el paso 8). El esquema `gota` ya existe en
`bd_conhydra` (se creó fuera de este flujo, no viene del deploy) — el backend
puede pegarle directamente.

## 7. Deploy de EPSEL-MOVIL — trae el frontend

Push/merge a `main` en **EPSEL-MOVIL**. Build+push de su imagen → el runner de
ese repo hace `docker compose pull frontend` + `docker compose up -d --no-deps
frontend`. Recién acá queda expuesto el único puerto público.

Si se prefiere no esperar a tener ambos runners listos, existe un camino manual
de bootstrap (una sola vez, para validar que todo funciona antes de confiar en
CI): copiar a mano los archivos de `deploy/` a `C:\epsel-deploy`, correr
`.\render-martin-config.ps1`, y `docker compose pull && docker compose up -d`
directamente por RDP. Pero el objetivo es que esto no haga falta de nuevo — una
vez configurado el paso 5, cada `git push` a `main` lo hace solo.

## 8. Verificación end-to-end

```powershell
cd C:\epsel-deploy
docker compose ps        # backend, martin, redis, frontend: los 4 "Up"
docker compose logs backend --tail 50
```
- `http://<ip-o-dominio-del-servidor>/` → carga la SPA.
- Login real (`/api/auth/login` vía el proxy de nginx) con un usuario del
  esquema `gota` de producción.
- `http://<servidor>/tiles/agua/0/0/0` → responde algo (aunque el mapa en sí
  necesita `public/map-style.production.json`, ya apuntando a `/tiles/...`).

## 9. Steady state — de ahora en adelante

Ya no hace falta tocar el servidor a mano: `git push` a `main` en cualquiera de
los dos repos dispara su propio build+deploy. Los únicos casos que vuelven a
requerir RDP:
- Cambios al **esquema** `gota` (nuevas tablas/columnas) — no se aplican solos
  desde este flujo, hay que aplicar el diff a mano (`ALTER TABLE ...`) contra
  `bd_conhydra` cuando cambie.
- Rotar `.env` (nuevas credenciales/secrets) — se edita directo en
  `C:\epsel-deploy\.env`, no vive en git.
- Los gotchas de Docker Desktop/permisos de servicio ya documentados en
  `WINDOWS_RUNNER_SETUP.md` §2 punto 4, si el runner no logra hablar con el
  daemon.

## 10. Backup periódico del esquema `gota`

`bd_conhydra` va a tener varios schemas (`sig`, `gota`, y tablas legacy en
`public`) — para no arrastrar todo `sig` (enorme, no es tuyo) en cada backup,
usar `-n gota` para dumpear **solo** el esquema propio:

```bash
pg_dump -h 172.16.5.222 -U postgres -d bd_conhydra -n gota -Fc -f "gota_backup_$(date +%Y%m%d).dump"
```

Restaurar (en cualquier máquina, no necesariamente producción — por ejemplo para
inspeccionar un backup viejo sin tocar la BD real):
```bash
createdb -h <destino> -U postgres bd_conhydra_restore
pg_restore -h <destino> -U postgres -d bd_conhydra_restore --no-owner --no-privileges "gota_backup_YYYYMMDD.dump"
```
Como el dump se generó con `-n gota`, todo queda schema-calificado como
`gota.*` — restaura solo ese esquema, no toca `sig` para nada. Correr esto con
algo de frecuencia (cron/Task Scheduler) una vez que haya datos reales de
producción, no solo como paso manual de la migración inicial.

## Pendientes conocidos (no bloquean el deploy, pero sí producción "real")

- Roles de Postgres dedicados en vez del superusuario `postgres` (hoy ambas
  conexiones, propia y `sig`, usan el mismo superuser).
- TLS/HTTPS delante de nginx (hoy HTTP plano en el puerto publicado).
- Migrar la BD OLAP (datamart, DDL en
  `~/Documentos/epsel_gota_datamart_star_schema.sql`) a producción como base de
  datos separada en el mismo servicio Postgres — no se toca en este flujo.
