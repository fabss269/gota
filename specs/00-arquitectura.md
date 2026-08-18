# 00 — Arquitectura (Fase 2)

> Estado: propuesta de diseño técnico, previa a Fase 3 (implementación). Cubre las
> decisiones transversales que aplican a todos los demás specs (01-09).

## 0. Convención: fechas naive en UTC

Todas las columnas de fecha/hora del esquema `gota` son `timestamp` **sin** zona
horaria (`ultimo_login`, `creado_en`, `fecha`, `fecha_registro`, etc. — ninguna es
`timestamptz`). Confirmado con Postgres real (`asyncpg` rechaza con error, no en
silencio, escribir un `datetime` con `tzinfo` en una columna así). Convención de código
en todos los módulos: cualquier `datetime.now(UTC)` que se vaya a persistir se guarda
como `datetime.now(UTC).replace(tzinfo=None)` — naive, pero UTC por convención en todo
el proyecto, nunca hora local del servidor. Si en algún momento se vuelve un problema
real (ambigüedad, bugs de zona horaria), la alternativa es migrar las columnas a
`timestamptz` — no se hizo ahora porque son cambios al DDL que edita Edgar externamente,
no algo para decidir unilateralmente desde el código.

## 1. Dos fuentes de datos, cero JOIN en SQL

Los esquemas `sig` (catastro EPSEL) y `gota` (dominio propio) viven en el mismo
Postgres (`bd_conhydra`), pero en código se acceden con dos engines de SQLAlchemy
independientes (pools y roles separados). Convención: no usar `JOIN` cross-schema
en SQL — cualquier composición de datos de ambos se resuelve en el service layer,
combinando resultados de queries separadas por engine.

- `PropiaDbEngine` — async, lectura/escritura, `asyncpg`. Es donde vive todo el dominio
  de negocio: `incidente`, `reclamo`, `usuario`, `estado_incidente_evento`, catálogos.
- `SigDbEngine` — async, **solo lectura**. Conecta a `bd_conhydra` vía el túnel SSH
  (`ssh.kasqan.com:15432`). Hasta que exista un rol dedicado de solo lectura en esa BD
  (pendiente con el equipo de Edgar), se refuerza en código: cada sesión abre con
  `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` — defensa en profundidad, no
  reemplaza pedir el rol real.

El enriquecimiento cruzado (ej. traer el `catastro` de un incidente) se resuelve **en la
capa de servicio**, en Python, nunca en SQL: el repositorio de `sig` y el de la BD propia
se consultan por separado (con `asyncio.gather` cuando no dependen entre sí) y el
`service` combina los resultados.

## 2. Estructura de módulos (SOLID / arquitectura modular)

```
app/
├── main.py
├── core/
│   ├── config.py        # Settings vía pydantic-settings, lee .env
│   ├── security.py      # JWT (access/refresh), hashing de password
│   └── exceptions.py    # Jerarquía DomainError + exception handlers globales
├── db/
│   ├── propia.py        # engine/session factory de la BD propia
│   └── sig.py           # engine/session factory de sig (solo lectura)
├── shared/
│   ├── schemas.py        # Page[T] genérico, ErrorResponse (spec 09)
│   └── deps.py           # get_current_user, require_role, parseo de paginación/filtros
└── modules/
    ├── auth/          (spec 01)
    ├── catalogos/     (spec 02)
    ├── incidencias/   (specs 03, 04, 05)
    ├── usuarios/      (spec 06)
    ├── red/           (spec 07)
    └── dashboard/     (spec 08)
```

Cada módulo sigue el mismo patrón interno, de arriba hacia abajo:

- **`router.py`** — `APIRouter`, solo traduce HTTP ↔ llamadas a `service`. Sin lógica de
  negocio, sin SQL.
- **`service.py`** — orquesta repositorios, aplica reglas de negocio, lanza `DomainError`
  cuando corresponde. No conoce SQLAlchemy ni FastAPI.
- **`repository.py`** (uno por fuente de datos cuando el módulo toca ambas, ej.
  `PropiaIncidenciaRepository` + `SigCatastroRepository`) — el único lugar con SQL/ORM.
- **`schemas.py`** — Pydantic, forma exacta de request/response según `API.md`.

**Inversión de dependencias:** `service.py` depende de un `Protocol` (interfaz)
definido en el propio módulo, no de la clase concreta del repositorio. FastAPI inyecta
la implementación real vía `Depends`. Esto permite tests con repositorios falsos sin
tocar la BD, y es lo que hace "intercambiable" la fuente de datos si algún día cambia.

## 3. Async en todo, concurrencia donde el I/O lo justifica

Todas las rutas y repositorios son `async`. Cuando un endpoint necesita datos de
`sig` y de la BD propia que no dependen entre sí (ej. detalle de incidencia: los datos
propios del incidente y el catálogo de materiales no dependen uno del otro), se piden
con `asyncio.gather` para pagar la latencia de ambas consultas en paralelo, no en serie.
Cuando sí hay dependencia (ej. primero necesito `suministro_codigo` del incidente para
después buscar en `cajaagua`), es secuencial — no hay atajo ahí, y no vale la pena
forzar concurrencia donde no aplica.

## 4. Configuración por entorno (`.env`)

`pydantic-settings.BaseSettings`, sin valores hardcodeados:

```
PROPIA_DB_URL=postgresql+asyncpg://...
SIG_DB_HOST=ssh.kasqan.com
SIG_DB_PORT=15432
SIG_DB_NAME=bd_conhydra
SIG_DB_USER=...
SIG_DB_PASSWORD=...
JWT_SECRET=...
JWT_ACCESS_EXPIRES_SECONDS=3600
JWT_REFRESH_EXPIRES_SECONDS=...
```

## 5. Manejo de errores (spec 09) centralizado

Jerarquía única en `core/exceptions.py`:

```
DomainError
├── CredencialesInvalidasError   → 401 CREDENCIALES_INVALIDAS
├── TokenExpiradoError           → 401 TOKEN_EXPIRADO
├── ValidacionError              → 400 VALIDACION (con detalle de campos)
├── NoEncontradoError            → 404 NO_ENCONTRADO
└── TransicionInvalidaError      → 409 TRANSICION_INVALIDA
```

Un único `exception_handler` global mapea cada subclase a la forma exacta
`{"error": {"code", "message"}}` de `API.md` §9. Los `service.py` de cada módulo lanzan
estas excepciones directamente — nunca arman la respuesta de error a mano, para que el
formato no se desincronice entre módulos.

## 6. El servicio de enriquecimiento catastral (pieza central, cross-cutting)

`modules/incidencias/catastro_enrichment.py` — un único responsable de todo el cruce con
`sig`, usado desde dos flujos distintos (creación de incidente, y detalle §4):

```python
class CatastroEnrichmentService:
    async def resolver_predio(self, suministro_codigo: str, categoria: Categoria) -> PredioCatastral | None:
        """
        Busca en sig.cajaagua (categoria=agua) o sig.cajadesague (categoria=desague)
        por inscripcion = suministro_codigo, excluyendo el centinela '00000000'.
        Desempate por cajaaguaid/cajadesagueid ascendente si hay más de una fila
        (~0.01% de los códigos reales).
        Devuelve sectorid, distritoid, localidadid y el punto (ST_Transform a 4326)
        ya resueltos — sin ST_Contains, están como columnas propias en cajaagua/cajadesague.
        Si no hay match (código no encontrado, o es el centinela), devuelve None —
        el llamador decide el fallback (no bloquea la creación del incidente).
        """
```

Se usa:
- **Al crear un incidente**: para poblar `latitud`/`longitud` (spec 03/05, decisión ya
  validada con datos reales de Lambayeque).
- **Al pedir el detalle** (`GET /incidencias/{id}`, spec 04): además del punto, una
  consulta de vecino más cercano (`ST_DWithin`/KNN, con los índices GiST que ya existen
  en `sig.agua`/`sig.alcantarillado`/`sig.buzones`) para armar `catastro.redAsociada`,
  `catastro.diametroMm`, `catastro.material`, `catastro.buzonCercano` — esta segunda
  parte NO se cachea, se resuelve en vivo en cada `GET` de detalle (es un solo request,
  no una lista paginada, el costo es aceptable).

**Pendiente de confirmar con Edgar antes de Fase 3**: si `categoria` (agua/desague) de
`catalogo_tipo_grupo` alcanza siempre para decidir `cajaagua` vs `cajadesague`, o si hace
falta revisar caso por caso contra la data real de `catalogo_tipo_atencion`.

## 7. Caché externa (Redis) para `sector`/`prioridad`/`estado` de `incidente`

**Corrección 2026-07-24**: la primera propuesta agregaba `estado_actual_id`,
`prioridad_id`, `sector_id`, `sector_nombre`, `distrito_id` como columnas directas de
`incidente`. Eso no es una caché, es redundancia dentro de la misma tabla transaccional
— dos lugares (la columna cacheada y la fuente real: `estado_incidente_evento`,
`incidente_alerta_regla`, `sig`) que pueden desincronizarse sin que nada lo detecte.
Revertido del DDL. El diseño correcto es una caché **externa** (Redis), que por
definición es desechable/reconstruible desde las fuentes reales — si se pierde o se
vacía, se reconstruye, nunca es la fuente de verdad.

**Estructura en Redis:**
- `cache:incidente:{incidente_id}:resumen` — hash con `estado_actual_id`,
  `prioridad_id`, `sector_id`, `sector_nombre`, `distrito_id`. Usado para armar
  rápido los campos derivados de la respuesta de `GET /incidencias` sin recalcular en
  cada lectura.
- `idx:estado:{estado_id}`, `idx:prioridad:{prioridad_id}`, `idx:sector:{sector_id}` —
  `SET` de `incidente_id` (índices invertidos, para poder filtrar por esos campos sin
  tenerlos como columna en Postgres).

**Escritura (mantiene la caché al día, no la reemplaza como fuente de verdad):**
- Al insertar un evento en `estado_incidente_evento` (spec 05,
  `IncidenciaService.registrar_evento`), después del commit: `SADD`/`SREM` el
  `incidente_id` entre los sets `idx:estado:*` viejo→nuevo, y actualiza el hash
  `resumen.estado_actual_id`.
- Al crear el incidente (spec 03/05): `CatastroEnrichmentService.resolver_predio` ya
  resuelve `sector_id`/`sector_nombre`/`distrito_id` una vez — el resultado se escribe
  directo en `cache:incidente:{id}:resumen` y en `idx:sector:{sector_id}`, **no** en
  una columna de `incidente`.
- Cuando exista el módulo de alertas (hoy fuera de alcance): mismo patrón para
  `prioridad_id`.

**Lectura para `GET /incidencias` con filtros por `estado`/`prioridad`/`sectorId`:**
1. Filtros sobre columnas reales de `incidente` (`creado_en`, `tipo_atencion_id`, `q`,
   `bbox` sobre `latitud`/`longitud`) van directo a SQL, con sus índices normales — no
   cambian por este diseño.
2. Si vienen `estado`/`prioridad`/`sectorId`/`distritoId` (csv, multi-valor): se
   resuelve primero en Redis (`SUNION` de los sets pedidos, `SINTER` si se combinan
   varios filtros), obteniendo el conjunto de `incidente_id` candidatos.
3. Se añade `WHERE incidente_id = ANY(:candidatos)` a la consulta SQL — la paginación
   (`LIMIT`/`OFFSET`) sigue siendo de Postgres, sobre el resultado ya acotado.
4. Los campos `sector`/`prioridad`/`estado` del `item` de respuesta se rellenan con un
   `MGET`/pipeline sobre `cache:incidente:{id}:resumen` de los ids de la página — en un
   *cache miss* (Redis frío para ese id), se recalcula en el momento contra las fuentes
   reales (join a `estado_incidente_evento`, etc.) y se repuebla la entrada — nunca se
   devuelve un dato inconsistente por no tenerlo en caché.

**Reconstrucción**: script `scripts/rebuild_incidencia_cache.py` — recalcula
estado/prioridad/sector para todos los incidentes activos y repuebla Redis desde cero
(correr en el primer deploy, o si el caché se vacía/pierde). Esto es lo que confirma que
es realmente una caché: puede regenerarse por completo desde Postgres+`sig` sin perder
información, porque nunca fue la única fuente de esos datos.

Tecnología propuesta: Redis (estándar, cliente async ya en `pyproject.toml`) — abierto a
otra si Edgar ya tiene infraestructura de caché corriendo en EPSEL.
