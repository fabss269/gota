# 07 — Capas de red (Bottom Sheet "Capas")

Módulo: `modules/red/`. El más simple de todos — solo `sig`, solo lectura, sin tocar la
BD propia para nada. No depende de ninguno de los gaps/decisiones pendientes de los
demás specs.

## `GET /red/capas?distritoId=&sectorId=&tipos=red_potable,valvulas,buzones`

Mapeo `tipo` (API.md) → tabla `sig`:

| `tipo` | Tabla `sig` | Filtro geom |
|---|---|---|
| `red_potable` | `sig.agua` | `ST_AsGeoJSON(ST_Transform(geom,4326))` |
| `red_primaria_desague` | `sig.alcantarillado WHERE primaria = true` | ídem |
| `red_secundaria_desague` | `sig.alcantarillado WHERE primaria = false` | ídem |
| `valvulas` | `sig.accesorios` join `accesoriotipos` filtrando por el grupo correspondiente a válvulas | ídem |
| `grifos_contra_incendio` | `sig.accesorios` join `accesoriotipos`, grupo hidrantes | ídem |
| `buzones` | `sig.buzones` | ídem |

Todas filtran por `distritoid`/`sectorid` (columnas propias en cada tabla, confirmado en
Fase 1 — no hace falta `ST_Contains`). `SigRedRepository` arma cada
`FeatureCollection` con `ST_AsGeoJSON` directo en SQL (evita traer la geometría cruda y
convertirla en Python — PostGIS ya la deja en el formato que la respuesta necesita).

**Sin caché en esta fase** — la red física cambia con poca frecuencia, pero el volumen
por tile/bbox suele ser manejable dado que ya se filtra por distrito/sector (no es "traer
todo el país" como advierte `API.md`). Si el volumen real lo justifica más adelante,
esto es candidato a servirse como vector tiles (Martin/pg_tileserv) en vez de GeoJSON
plano — anotado como posible optimización futura, no bloqueante para Fase 3.

## Estado de implementación (2026-07-24)

Código escrito y verificado contra `sig` real: `red_potable` (1031 features en el sector
de prueba), `buzones` (697), `red_primaria_desague`/`red_secundaria_desague` (146/1949)
devuelven geometría real vía `ST_AsGeoJSON`. Respuesta: objeto `{ "<tipo>":
FeatureCollection, ... }`, una entrada por `tipo` pedido (documentado también en
`API.md` §10).

**Gap real de catálogo encontrado**: `sig.accesoriotipos` tiene solo 20 filas, todas con
`grupo = 'AGUA POTABLE'`, y son nombres de accesorios de tubería genéricos (Codo, Tapón,
T, Cruz, Abrazadera, Transición, etc.) — **ninguna se llama "válvula" ni
"grifo"/"hidrante"**. No hay forma de distinguir esos dos tipos con la data real actual.
Implementado con `ILIKE` sobre el nombre del tipo (`%valvula%`, `%grifo%`) como mejor
esfuerzo — con la data real de hoy, `valvulas` y `grifos_contra_incendio` devuelven
`FeatureCollection` vacía siempre, no es un bug de la consulta. **A confirmar con
Edgar/CONHYDRA**: si esa distinción existe en otra tabla no explorada, o si esos dos
tipos de capa no tienen data real todavía en este ambiente.
