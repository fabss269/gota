# 02 — Catálogos

Módulo: `modules/catalogos/`. Mezcla BD propia (catálogos de negocio) y `sig`
(distritos/sectores geográficos) — es el módulo con más repositorios distintos por
pocas líneas de lógica cada uno.

Todos cacheables en el cliente (`API.md` ya lo indica) — en el backend basta con
`Cache-Control` largo en la respuesta, no hace falta cachear en Redis ni nada adicional
para el volumen de filas involucrado (decenas, no miles).

| Endpoint | Fuente | Notas |
|---|---|---|
| `GET /catalogos/distritos` | `sig.distritos` | `WHERE departamentocod = '14'` (Lambayeque, confirmado con Edgar) — **no** point-in-polygon ni whitelist de 17 ids, filtro simple por departamento. `id` = `ubigeo` (código nacional de 6 dígitos, único de verdad — `distritocod` solo es único dentro del departamento, no sirve como id global) |
| `GET /catalogos/sectores?distritoId=` | `sig.sectores` | Filtra por `distritoid` (recibe el `ubigeo` del distrito, se resuelve a `distritoid` antes de filtrar). `id` = `sectorid` — `codi_secto` se repite entre distritos ("01","02"... en cada uno), no es un id válido por sí solo |
| `GET /catalogos/tipos-atencion` | `catalogo_tipo_atencion` + `catalogo_tipo_grupo` | `categoria` del JSON = `catalogo_tipo_grupo.codigo` (debe sembrarse como `agua`/`desague` exactamente — dato de seed, no de esquema) |
| `GET /catalogos/estados` | `catalogo_estado` | `codigo` debe sembrarse como `CREADO/PENDIENTE/EN_PROGRESO/ATENDIDO` exactamente |

**Nota de seeds (no de código):** varios de estos catálogos dependen de que los
`codigo` sembrados en la BD propia coincidan carácter por carácter con los valores que
`API.md` documenta como fijos (`categoria: agua|desague`, los 4 estados, los 7 valores
de `motivo` en spec 05). Esto es un script de seed/migración de datos, no una decisión
de arquitectura — lo dejo anotado para no perderlo antes de Fase 3.

Repositorios: `SigCatalogoRepository` (distritos, sectores) y `PropiaCatalogoRepository`
(el resto) — ambos de solo lectura. Dos `service.py` separados (`SigCatalogoService`,
`PropiaCatalogoService`), no uno solo con repositorios opcionales — cada endpoint solo
necesita una de las dos fuentes, meterlas juntas obligaba a pasar `None` con
`# type: ignore` para la que no aplicaba en cada caso.

## Estado de implementación (2026-07-24)

Código escrito y `ruff check` limpio. Verificado end-to-end contra bases reales:
- `GET /catalogos/estados`, `GET /catalogos/tipos-atencion` — BD propia local, con seed
  mínimo. Responden exactamente en el formato de `API.md`.
- `GET /catalogos/distritos` — verificado una vez contra `sig` real (38 distritos de
  Lambayeque). El túnel SSH (`ssh.kasqan.com:15432`) se cayó a mitad de sesión
  (infraestructura externa, no un bug de este código) antes de poder probar el resto.
- `GET /catalogos/sectores` — **sin verificar en vivo todavía**, mismo patrón de
  repositorio que `distritos`. Primer pendiente al retomar con el túnel funcionando.
