# Setup del self-hosted runner en el VPS de producción (Contabo, Linux)

Un **GitHub Actions self-hosted runner** corre como servicio `systemd` en el
propio VPS y se conecta DE SALIDA a GitHub (HTTPS 443) — no hace falta IP
pública dedicada a esto ni puertos entrantes para el runner en sí (el único
puerto entrante que necesita el VPS es el 80/443 de nginx, ver
`PRODUCTION_DEPLOY.md`). Mucho más simple que el equivalente en Windows (sin
RDP, sin WSL2, sin los gotchas de sesión/pipe de Docker Desktop) — Docker
Engine nativo en Linux no tiene ese problema.

Los pasos de abajo se corren una sola vez, por SSH.

## 1. Carpeta de deploy persistente (una sola, compartida por los dos repos)

```bash
sudo mkdir -p /opt/epsel-deploy
sudo chown "$USER":"$USER" /opt/epsel-deploy
```

Crear ahí un `.env` real (nunca versionado) basado en `deploy/.env.example` de
`gota-backend`, con credenciales **generadas de cero** para este VPS
(`DB_PASSWORD`, `JWT_SECRET` — ej. `openssl rand -hex 32` para cada una, no
reusar nada del `.env.example` viejo, ver el comentario de ese archivo sobre
credenciales que quedaron expuestas en git). Esta carpeta y su `.env` **no los
toca ningún workflow de CI** salvo para copiar/leer
`docker-compose.yml`/`martin-config.*` — el `.env` en sí se administra a mano.

## 2. Usuario del runner tiene que poder hablar con Docker

El runner necesita ejecutar `docker compose` sin `sudo`. Si el usuario que va
a correr el runner no es el mismo que instaló Docker:

```bash
sudo usermod -aG docker "$USER"
# cerrar sesión SSH y volver a entrar para que el grupo nuevo tome efecto
```

Verificar: `docker ps` sin `sudo` no debe pedir permisos.

## 3. Registrar el runner — una vez por cada repo

GitHub no permite compartir runners entre repos de una cuenta personal (solo
en organizaciones) — hay que repetir esto dos veces, una por repo, con
carpetas distintas para que convivan en la misma máquina.

Para cada repo (`ivanedAC/epsel-backend` y `ivanedAC/EPSEL-MOVIL`):

1. En GitHub: **Settings → Actions → Runners → New self-hosted runner →
   Linux**.
2. GitHub muestra comandos con un token de registro temporal (expira en
   minutos, no reutilizable entre repos) — copiarlos tal cual los da, algo
   como:
   ```bash
   mkdir ~/actions-runner-epsel-backend && cd ~/actions-runner-epsel-backend
   curl -o actions-runner-linux-x64.tar.gz -L <url-que-da-GitHub>
   tar xzf actions-runner-linux-x64.tar.gz
   ./config.sh --url https://github.com/ivanedAC/epsel-backend --token <TOKEN>
   ```
   Usar una carpeta distinta por repo (`~/actions-runner-epsel-backend`,
   `~/actions-runner-epsel-movil`) — son dos instalaciones independientes del
   runner, cada una registrada a su propio repo.
3. Instalar como **servicio systemd** (para que sobreviva reinicios y no
   dependa de una sesión SSH abierta):
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```
   `sudo ./svc.sh status` confirma que quedó activo; los logs van a
   `journalctl -u actions.runner.<repo>.<host> -f` si algo falla.

Repetir para el segundo repo con su propio token/carpeta.

## 4. Configurar la repo variable `DEPLOY_PATH` — en AMBOS repos

**Settings → Secrets and variables → Actions → Variables → New repository
variable**: `DEPLOY_PATH` = `/opt/epsel-deploy` (la misma ruta del paso 1, en
los dos repos — ambos despliegan contra la misma carpeta/compose).

No hace falta ningún secret nuevo (`DEPLOY_SSH_KEY`, host, usuario, puerto no
aplican — no hay SSH desde GitHub hacia el VPS, el runner ya está adentro).
`GITHUB_TOKEN` para autenticar contra GHCR ya lo provee GitHub automáticamente
en cada job, no hay que crearlo a mano.

## 5. Primer deploy

Con los runners registrados y la variable configurada, seguir
[`PRODUCTION_DEPLOY.md`](./PRODUCTION_DEPLOY.md) desde el paso de migración de
datos en adelante (orden exacto del primer deploy y verificación) — no
repetido acá para no tener dos versiones del mismo checklist que puedan
desalinearse.
