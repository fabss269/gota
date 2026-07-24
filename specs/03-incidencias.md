# 03 — Incidencias: mapa y lista

Módulo: `modules/incidencias/`. Repositorio Postgres (`PropiaIncidenciaRepository`) +
caché Redis (`IncidenciaCacheRepository`, spec 00 §7) — `incidente` en sí **no** tiene
columnas de estado/prioridad/sector, esos tres se resuelven vía Redis, no en SQL.

## `GET /incidencias`

Query params → `IncidenciaFilterParams` (Pydantic, `shared/deps.py`), todos opcionales
salvo paginación:

| Param API.md | Columna/filtro |
|---|---|
| `fecha` (`YYYY-MM-DD`\|`hoy`) | `incidente.creado_en::date = :fecha` |
| `fechaDesde`/`fechaHasta` | `incidente.creado_en BETWEEN` |
| `categoria` (csv) | join `catalogo_tipo_atencion.tipo_grupo_id → catalogo_tipo_grupo.codigo IN (...)` |
| `prioridad` (csv) | Redis `SUNION idx:prioridad:{id}` por cada código pedido → set de `incidente_id` candidatos |
| `estado` (csv) | Redis `SUNION idx:estado:{id}` → ídem |
| `distritoId`, `sectorId` | Redis `idx:sector:{id}` → ídem |
| `tipoAtencionId` | `incidente.tipo_atencion_id = :id` |
| `q` | `ILIKE` sobre `incidente.direccion` + `catalogo_tipo_atencion.nombre` (búsqueda libre tipo+dirección, tal como pide `API.md`) |
| `bbox` | `incidente.latitud BETWEEN :minLat AND :maxLat AND longitud BETWEEN :minLon AND :maxLon` — suficiente con índice btree compuesto; no hace falta PostGIS aquí porque el punto ya vive como `numeric` en la BD propia, no como `geometry` |
| `page`, `pageSize` | `LIMIT`/`OFFSET`, default `pageSize=10` (igual que `API.md`) |

Filtros sobre columnas reales de `incidente` (`fecha`, `categoria` vía join,
`tipoAtencionId`, `q`, `bbox`) van directo a SQL con `AND` — construidos dinámicamente
en el repositorio (`select().where(*condiciones)`, agregando condiciones solo si el
parámetro vino en el request). Cuando además vienen `estado`/`prioridad`/
`sectorId`/`distritoId`, el `service.py` resuelve primero los candidatos en Redis
(paso anterior) y añade `incidente_id = ANY(:candidatos)` a ese mismo `WHERE` — la
paginación (`LIMIT`/`OFFSET`) sigue siendo de Postgres sobre el conjunto ya acotado.

## Mapeo de respuesta (`items[]`)

- `id` = `incidente.codigo` (no el UUID interno — el UUID nunca sale al API)
- `tipo`/`categoria` = join a `catalogo_tipo_atencion`/`catalogo_tipo_grupo`
- `direccion` = `incidente.direccion`
- `sector`, `prioridad`, `estado` = `MGET`/pipeline de
  `cache:incidente:{id}:resumen` para los ids de la página (spec 00 §7). En un *cache
  miss* puntual, `IncidenciaCacheRepository` recalcula contra la fuente real
  (`estado_incidente_evento`/`incidente_alerta_regla`/`sig`) y repuebla esa entrada —
  nunca se sirve un dato inconsistente por no estar en caché.
- `antiguedadDias` = `(now() - incidente.creado_en)` calculado en SQL o en Python, no
  se guarda (es derivado puro, cambia todos los días, cachearlo sería incorrecto)
- `lat`/`lon` = `incidente.latitud`/`longitud` directo
- `fechaCreacion` = `incidente.creado_en`

## Nota de implementación de `API.md` (clustering)

El agrupamiento de pines para el mapa se calcula en el cliente — el backend no hace
nada especial más allá de servir la lista filtrada por `bbox`. No se implementa
`GET /incidencias/clusters` en esta fase (documentado en `API.md` como posible extensión
futura, no requisito actual).

## Estado de implementación (2026-07-24)

Código escrito (`app/modules/incidencias/`) y verificado end-to-end contra BD propia
local + `sig` real + Redis (Docker) + los 4 incidentes de prueba de
`scripts/seed_dev.py`: filtros por `estado`/`prioridad`/`categoria`/`q`/`bbox`/`sectorId`
(incluyendo el camino Redis con *cache miss* → recálculo → repoblado), paginación.
`ruff check` limpio.

**Sin módulo de alertas implementado** (fuera de alcance, spec 00 §7): no hay forma real
de calcular `prioridad_id` todavía. `IncidenciaService._resolver_resumen` usa como
default la prioridad de menor `orden` en `catalogo_prioridad` (sembrada como
`a_tiempo`/`alerta`/`critica`) hasta que ese módulo exista — decisión de implementación,
no de spec, documentada en el código.
