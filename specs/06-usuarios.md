# 06 — Usuarios (selector de responsable)

Módulo: `modules/usuarios/`. Solo BD propia + una resolución transitiva contra `sig`.

## `GET /usuarios?rol=tecnico,supervisor&sectorId=`

- `rol` (csv) → join `rol.codigo IN (...)`.
- `sectorId` — **este es el filtro interesante**: `usuario` no tiene `sector_id` (se
  descartó esa columna a propósito, ver memoria del proyecto). Edgar lo explicó así:
  "el usuario está relacionado a evento, evento a incidencia, y la incidencia tiene su
  suministro, del cual se puede sacar el sector". Traducido a consulta:

```sql
-- incidente más reciente donde el usuario quedó asignado
SELECT e.incidente_id
FROM estado_incidente_evento e
WHERE e.usuario_id = :usuario_id
ORDER BY e.fecha DESC
LIMIT 1
```

  con ese `incidente_id`, el sector sale de la caché Redis
  (`cache:incidente:{id}:resumen.sector_id`/`sector_nombre`, spec 00 §7) — no de una
  columna en `incidente` (esa tabla no guarda sector). En *cache miss*, se recalcula con
  `CatastroEnrichmentService.resolver_predio` contra el `suministro_codigo` de ese
  incidente. Filtrar `GET /usuarios` por `sectorId` es la operación inversa: primero
  `idx:sector:{sectorId}` en Redis da los `incidente_id` de ese sector, luego se busca
  qué `usuario_id` tiene su evento más reciente en alguno de esos incidentes.

- `cuadrilla` — **se quita del schema de respuesta**. Edgar: "ya no asignaremos
  cuadrillas, ahora asignaremos área y usuario a una incidencia". El campo `cuadrilla`
  de `API.md` §6 queda obsoleto frente al nuevo modelo — a actualizar en `API.md` cuando
  se confirme, no es algo que el backend deba simular.
- `sector` en la respuesta = `sector_nombre` leído de la caché Redis del incidente más
  reciente de ese usuario (arriba), no un nuevo cálculo contra `sig`.

**Costo**: la parte SQL (`usuario`/`estado_incidente_evento`) es toda BD propia, barata.
La resolución de sector pasa por Redis primero — solo cae a recalcular contra `sig` en
un *cache miss*, y aun así `GET /usuarios` es una lista pequeña y poco frecuente
(selector de UI), no el hot path que sí es `GET /incidencias`.

## Estado de implementación (2026-07-24)

Implementado distinto a como se planteó arriba para el filtro `sectorId`: en vez de
partir de `idx:sector:{sectorId}` en Redis (que puede estar frío para incidentes que
nunca pasaron por un `GET /incidencias`/`detalle`), se resuelve el sector real de cada
usuario candidato (ya acotado por `rol`, lista chica) vía caché-o-recálculo — mismo
patrón que `IncidenciaService._resolver_resumen` — y se compara en Python. Correcto
incluso con caché fría, a costa de resolver sector para todos los candidatos en vez de
solo los del sector pedido; aceptable dado que la lista de usuarios ya es chica.
Verificado end-to-end con el usuario técnico sembrado, filtrando por `rol` y por
`sectorId` (siguiendo su evento más reciente en tiempo real).
