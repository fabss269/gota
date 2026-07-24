# 08 — Dashboard

Módulo: `modules/dashboard/`. Solo BD propia, todo agregación sobre `incidente` +
`estado_incidente_evento` + catálogos.

`API.md` ya marca los 4 KPIs de `kpis` como **en espera** — el cliente sigue sobre mock
mientras tanto. Implicación para Fase 3: `GET /dashboard/resumen` puede construirse
completo, pero `kpis` no es lo prioritario para la primera versión funcional; el resto sí:

| Campo | Fuente |
|---|---|
| `porCategoria` | `count(*) GROUP BY catalogo_tipo_grupo.codigo`, filtrado por `fechaDesde/fechaHasta` sobre `incidente.creado_en` |
| `topTiposAtencion` | `count(*) GROUP BY tipo_atencion_id ORDER BY count DESC LIMIT N`, join `catalogo_tipo_atencion.nombre` |
| `prioridadPorSector` | `sector_id` no es columna de `incidente` (spec 00 §7, vive en Redis) — no se puede hacer un `GROUP BY` SQL directo. Se recorre cada sector (`sig.sectores`, ~55 filas) pidiendo su `idx:sector:{id}` en Redis, y por cada set de `incidente_id` se calcula `AVG` en Postgres (`WHERE incidente_id = ANY(:ids)`) — 55 consultas chicas, aceptable para un endpoint de dashboard que no es de alta frecuencia |
| `serieTickets` | `API.md` lo marca "ilustrativo en ambos lados" — no se implementa contra datos reales en esta fase, se deja como placeholder explícito en el schema de respuesta |
| `kpis.*` | en espera — no se calcula, el endpoint puede devolver el objeto con valores en `0`/`null` o directamente omitirlo hasta que Edgar confirme que ya no está en espera |

Sin repositorio nuevo — reutiliza `PropiaIncidenciaRepository` con métodos de
agregación (`get_resumen_por_categoria`, etc.), no un repositorio propio del módulo
dashboard, para no duplicar el mapeo de `incidente`↔catálogos que ya vive en
`incidencias/repository.py`.

## Estado de implementación (2026-07-24)

Implementado tal como se especificó arriba, verificado end-to-end. `kpis` devuelve el
objeto con todos los valores en `0`/`0.0` (en espera, sin calcular). `serieTickets`
devuelve `[]` (placeholder explícito, "ilustrativo en ambos lados" según `API.md`).
`prioridadPorSector` solo incluye sectores con al menos un incidente en
`idx:sector:{id}` (Redis) — sectores sin actividad se omiten en vez de aparecer con
`antiguedadPromedioDias` sin sentido.
