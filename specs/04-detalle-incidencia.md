# 04 — Detalle de incidencia

Módulo: `modules/incidencias/`. Este sí toca ambas fuentes en el mismo request — es el
caso de uso principal de `CatastroEnrichmentService` (spec 00 §6).

## `GET /incidencias/{id}`

Secuencia en `service.py`:

1. `PropiaIncidenciaRepository.get_by_codigo(id)` → si no existe, `NoEncontradoError`.
2. En paralelo (`asyncio.gather`, no dependen entre sí):
   - `PropiaIncidenciaRepository.get_tecnico_asignado(incidente_id)` → última fila de
     `estado_incidente_evento` con `usuario_id IS NOT NULL`, join `usuario`
   - `PropiaIncidenciaRepository.get_ultimo_reclamo(incidente_id)` → para el bloque
     `reclamo` del JSON (`fechaRegistro`, `medioRecepcion`, `descripcion`)
3. Con el `suministro_codigo` + `categoria` ya conocidos del paso 1:
   `CatastroEnrichmentService.resolver_predio(...)` (ver spec 00 §6) para `sector` +
   punto — y una consulta adicional de vecino más cercano contra `sig.agua` /
   `sig.alcantarillado` / `sig.buzones` (según `categoria`) para armar:
   - `catastro.redAsociada` — `sig.agua.aguatipoid → aguatipos.aguatipo` (o
     `alcantarilladotipos` para desague) de la línea más cercana
   - `catastro.diametroMm` — `sig.agua.diametro` / `alcantarillado` de esa misma línea
   - `catastro.material` — `sig.materiales.material` vía `materialid`
   - `catastro.buzonCercano` — `sig.buzones` más cercano + su `codigo` y `cota` (desde
     `sig.cotas` si existe registro, si no queda solo el código)
   - `catastro.sector` — mismo valor que ya resolvió `resolver_predio`
4. Si `resolver_predio` devuelve `None` (código `'00000000'` o sin match — ver spec 00,
   ~34% de los casos en `sig`), el bloque `catastro` completo se omite/queda `null` en
   la respuesta — **no** es un error, es un incidente sin georreferencia catastral
   automática (pasó igual con la creación, el incidente existe con o sin ese dato).

## `quejasAgrupadas` y `foco` — sin tabla propia, es un algoritmo

No hay ninguna tabla que modele "causa común". Propuesta de cálculo en
`PropiaIncidenciaRepository.get_incidencias_relacionadas(incidente)`:

- Mismo `tipo_atencion_id`
- `ST_DWithin`-equivalente casero: `latitud`/`longitud` dentro de un radio (a definir,
  ej. 150m — parámetro de config, no hardcode) — como son `numeric` planos en la BD
  propia, esto es una comparación de rango, no PostGIS
- Ventana de tiempo (ej. últimos 30 días — también config)
- `quejasAgrupadas` = count de `reclamo` ligados a esos incidentes relacionados
- `foco.incidenciasRelacionadasIds` = los `codigo` de esos incidentes (máx. N, a definir)

Esto es explícitamente una heurística de negocio, no una verdad derivada del esquema —
**debe validarse con Edgar como regla de producto antes de fijar el radio/ventana**, no
es una decisión puramente técnica.

## `GET /incidencias/{id}/trazabilidad`

Directo: todas las filas de `estado_incidente_evento` para ese incidente, ordenadas por
`fecha`, mapeadas a `{estado, fecha, grupo?, asignadoA?, nota?}`. `asignadoA` sale de
`usuario_id`+`area_id` cuando el evento los trae.

## `GET /incidencias/{id}/predio`

`reclamo` histórico — filtra por el mismo `dni` (si el reclamo actual lo trae) o, en su
defecto, texto de `direccion_detalle` similar (menos confiable, es texto libre). El
endpoint alternativo `GET /predios/{direccionId}/reclamos` que `API.md` deja "a decidir"
no se implementa en esta fase — no hay un id de predio normalizado en la BD propia para
soportarlo sin inventar una entidad nueva.

## Estado de implementación (2026-07-24)

Código escrito y verificado end-to-end contra `sig` real (túnel SSH) + BD propia local.
Confirmado con Edgar: heurística de `quejasAgrupadas`/`foco` con radio **150m** y ventana
**30 días**, configurables en `core/config.py`
(`quejas_radio_metros`/`quejas_ventana_dias`/`quejas_max_relacionadas`), no hardcodeados.
`foco` queda `null` cuando no hay incidencias relacionadas (no es un error, spec ya lo
preveía). `predio.noReincidente`/`quejasUltimos6Meses` se calculan sobre los reclamos
históricos del mismo `dni`, ventana de 182 días.

**Gap real de `sig` encontrado al implementar `resolver_catastro_cercano`**:
`sig.alcantarillado` (desagüe) **no tiene columna de diámetro** — a diferencia de
`sig.agua`, que sí la tiene (`agua.diametro`). Para incidentes de categoría `desague`,
`catastro.diametroMm` sale `null` siempre; no es un bug de la consulta, es que el dato no
existe en el esquema real. A confirmar con Edgar/CONHYDRA si esa columna existe en algún
otro lugar (ej. `alcantarilladocota` u otra tabla no explorada) o si simplemente no se
releva ese dato para la red de desagüe.

`redAsociada` en los datos reales frecuentemente sale `"Se desconoce"` (agua) o
`"Desconocido"` (desague) — es el valor real de `aguatipos`/`alcantarilladotipos` para
buena parte de la red, no un error de mapeo.
