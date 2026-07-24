# 05 — Acciones sobre incidencia

Módulo: `modules/incidencias/`. Todo pasa por `estado_incidente_evento` — no queda
ninguna tabla `asignacion` ni `catalogo_avance` (eliminadas, ver memoria del proyecto).

## `GET /incidencias/{id}/transiciones-validas`

`API.md` ya aclara que esto **no es una regla de negocio fija en el backend** — Edgar
planea configurarlo desde un futuro portal admin. Confirmado además al quitar
`catalogo_avance`: el mapeo motivo→estado-resultante vive en código, no en tabla.

Propuesta: `core/config.py` o un módulo `transiciones.py` con la máquina de estados
como estructura de datos en Python (no hardcodeada dentro del `service`, para que
mover esto a una tabla configurable el día de mañana sea cambiar una función, no
reescribir el flujo):

```python
TRANSICIONES: dict[str, list[Transicion]] = {
    "CREADO":      [Transicion(hacia="PENDIENTE", requiere_formulario=False)],
    "PENDIENTE":   [Transicion(hacia="EN_PROGRESO", requiere_formulario=False)],
    "EN_PROGRESO": [Transicion(hacia="EN_PROGRESO", requiere_formulario=True),
                    Transicion(hacia="ATENDIDO", requiere_formulario=False)],
    "ATENDIDO":    [],
}
```

`service.py` lee el estado actual desde la caché Redis (`cache:incidente:{id}:resumen`,
spec 00 §7 — en *cache miss*, cae a la última fila de `estado_incidente_evento`), lo
mapea a `codigo`, y devuelve `TRANSICIONES[codigo]`.

## `POST /incidencias/{id}/avances`

- Valida que `motivo` sea uno de los 7 valores fijos de `API.md` (enum a nivel Pydantic,
  no catálogo en BD — coherente con haber quitado `catalogo_avance`).
- Valida la transición contra `TRANSICIONES` (arriba) — si `motivo` implica un
  `estado_resultante` no permitido desde el estado actual → `TransicionInvalidaError`
  (409).
- Inserta fila en `estado_incidente_evento` (`motivo`, `nota`, `estado_resultante_id`,
  `usuario_id` = usuario autenticado si el motivo es `REASIGNAR_TECNICO`, `area_id` si
  aplica).
- Después del commit: actualiza la caché Redis (`idx:estado:*` viejo→nuevo,
  `resumen.estado_actual_id`, spec 00 §7) — si esta escritura a Redis falla, no revierte
  la transacción de Postgres (la caché es desechable, se autocorrige en el próximo
  *cache miss* o en la reconstrucción); Postgres/`estado_incidente_evento` sigue siendo
  la única fuente de verdad.
- Respuesta 201: el evento recién creado, misma forma que el array de spec 04.

## `PATCH /incidencias/{id}/estado`

Atajo del mismo flujo que `POST /avances` pero sin pasar por un `motivo` de catálogo —
inserta un evento con `estado_resultante_id` directo. Debe pasar por la misma validación
de `TRANSICIONES`, para no abrir una puerta trasera que salte la máquina de estados.

## `PATCH /incidencias/{id}/responsable`

Inserta un evento en `estado_incidente_evento` con `usuario_id = tecnicoId` (y
`area_id` si el request lo trae — el payload actual de `API.md` solo tiene `tecnicoId`,
puede necesitar ampliarse a `{tecnicoId, areaId?}` dado que ahora se asigna área+usuario,
no solo usuario — **confirmar con Edgar si el contrato de este endpoint cambia**),
`estado_resultante_id` = el mismo estado actual (una reasignación no necesariamente
cambia el estado). `motivo` libre tipo "Reasignación manual".

## Estado de implementación (2026-07-24)

Confirmado con Edgar: payload `{tecnicoId?, areaId?}` (ambos opcionales, al menos uno
requerido — `ResponsablePatchRequest` valida esto). Razón textual de Edgar: "se asigna
por evento, en cada evento se asignan cosas nuevas... el campo es nullable... dependiendo
de cada cosa se puede llenar algunos sí y algunos no" — o sea, un evento de reasignación
puede tocar solo técnico, solo área, o ambos; quien necesite "el área actual" consulta el
último evento con `area_id IS NOT NULL`, igual que ya se hacía para `tecnicoAsignado`.
Restringido a rol `supervisor` (`require_role`, `shared/deps.py`) — confirmado con
Edgar. Se agregó `PermisosInsuficientesError` (403, código `PERMISOS_INSUFICIENTES`) a
`core/exceptions.py`, no estaba en el modelo de errores original de `API.md` §9.

`POST /avances` implementado con un mapeo `motivo → estado_resultante` explícito
(`transiciones.py::MOTIVO_ESTADO`) — el request de `API.md` no trae un estado destino
explícito, solo `motivo`, así que hace falta esa tabla para saber contra qué transición
de `TRANSICIONES` validar. Es una decisión de implementación de Fase 3, documentada como
tal en el código (candidata a moverse al futuro portal admin junto con `TRANSICIONES`).
`usuario_id` en el evento de avance solo se llena cuando `motivo=REASIGNAR_TECNICO`
(autoasignación del técnico logueado, "me hago cargo") — reasignar a otro técnico
específico sigue siendo vía `PATCH /responsable`, no `POST /avances`.

Todo verificado end-to-end: transición inválida → 409, flujo completo
`CREADO → PENDIENTE → EN_PROGRESO → ATENDIDO`, reasignación con 403 (rol no autorizado) y
200 (supervisor), validación 422 cuando `ResponsablePatchRequest` no trae ningún campo.
