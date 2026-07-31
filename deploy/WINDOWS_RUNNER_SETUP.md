# Setup del self-hosted runner en el Windows Server de producción

El servidor solo tiene RDP (sin SSH), así que el CI/CD ya no se conecta hacia él —
en vez de eso, un **GitHub Actions self-hosted runner** corre como servicio de
Windows en el propio servidor y se conecta DE SALIDA a GitHub (HTTPS 443), sin
necesidad de IP pública ni puertos entrantes. Los pasos de abajo se corren una
sola vez, a mano, por RDP.

Requisito ya confirmado: Docker en ese servidor corre contenedores **Linux** (vía
WSL2) — todas las imágenes de este stack (Python, nginx, Martin, Redis) son Linux,
no Windows containers.

## 1. Carpeta de deploy persistente (una sola, compartida por los dos repos)

```powershell
New-Item -ItemType Directory -Force -Path C:\epsel-deploy
```

Copiar ahí un `.env` real (nunca versionado) basado en `deploy/.env.example` de
`gota-backend`, con las credenciales reales de producción (`SIG_DB_PASSWORD`,
`JWT_SECRET`, etc.) y `DEPLOY_PATH` (ver más abajo) apuntando a esta misma carpeta.
Esta carpeta y su `.env` **no los toca ningún workflow de CI** salvo para
copiar/leer `docker-compose.yml`/`martin-config.*` — el `.env` en sí se administra
a mano.

## 2. Registrar el runner — una vez por cada repo

GitHub no permite compartir runners entre repos de una cuenta personal (solo en
organizaciones) — hay que repetir esto dos veces, una por repo, con nombres de
servicio distintos para que convivan en la misma máquina.

Para cada repo (`ivanedAC/epsel-backend` y `ivanedAC/EPSEL-MOVIL`):

1. En GitHub: **Settings → Actions → Runners → New self-hosted runner → Windows**.
2. GitHub muestra comandos con un token de registro temporal (expira en minutos,
   no reutilizable entre repos) — copiarlos tal cual los da, algo como:
   ```powershell
   mkdir C:\actions-runner-epsel-backend ; cd C:\actions-runner-epsel-backend
   Invoke-WebRequest -Uri <url-que-da-GitHub> -OutFile actions-runner.zip
   Expand-Archive -Path actions-runner.zip -DestinationPath .
   ./config.cmd --url https://github.com/ivanedAC/epsel-backend --token <TOKEN>
   ```
   Usar una carpeta distinta por repo (`C:\actions-runner-epsel-backend`,
   `C:\actions-runner-epsel-movil`) — son dos instalaciones independientes del
   runner, cada una registrada a su propio repo.
3. Instalar como **servicio de Windows** (para que sobreviva reinicios y no
   dependa de una sesión RDP abierta):
   ```powershell
   ./svc.cmd install
   ./svc.cmd start
   ```
4. **Importante con Docker Desktop**: si el servicio corre como `NT AUTHORITY\
   SYSTEM` (default), puede no tener acceso al pipe de Docker a menos que la
   cuenta esté en el grupo local `docker-users`, o que Docker Desktop esté
   configurado para exponerse sin sesión interactiva. Si `docker compose` falla
   con un error de conexión al daemon en el primer deploy, ese es el sospechoso
   más probable — revisar la config del servicio (`services.msc` →
   propiedades → Log On) o correr Docker Engine directo en vez de Desktop.

Repetir para el segundo repo con su propio token/carpeta.

## 3. Configurar la repo variable `DEPLOY_PATH` — en AMBOS repos

**Settings → Secrets and variables → Actions → Variables → New repository
variable**: `DEPLOY_PATH` = `C:\epsel-deploy` (la misma ruta del paso 1, en los
dos repos — ambos despliegan contra la misma carpeta/compose).

No hace falta ningún secret nuevo (`DEPLOY_SSH_KEY`, host, usuario, puerto ya no
aplican — no hay SSH). `GITHUB_TOKEN` para autenticar contra GHCR ya lo provee
GitHub automáticamente en cada job, no hay que crearlo a mano.

## 4. Primer deploy

- Push a `main` en `gota-backend` primero (deja `docker-compose.yml`,
  `martin-config.template.yaml`, `vp_gota_create.ddl` y el `.env` real listos en
  `C:\epsel-deploy`, y levanta backend+martin+redis).
- Luego push a `main` en `EPSEL-MOVIL` (o simplemente esperar a que su propio
  deploy corra) para traer el servicio `frontend`.
- Verificar con `docker compose ps` en `C:\epsel-deploy` que los 4 servicios estén
  arriba, y confirmar que el esquema `gota` ya fue aplicado contra `bd_conhydra`
  (ver sección "Despliegue" del README de `gota-backend`) antes de este primer
  `up`, si aún no se hizo.
