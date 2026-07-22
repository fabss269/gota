# Spec 07 · Acciones sobre una incidencia (Cambiar estado / Registrar avance / Reasignar responsable)

**Estado:** ✅ Implementada
**Depende de:** `06-detalle-incidencia.md`
**Boards Penpot de referencia:** `Overlay - Cambiar Estado`,
`Overlay - Registrar Avance`, `Overlay - Seleccionar Responsable`
**API relacionada:** `docs/API.md` § Incidencias / Acciones

## 1. Contexto

Tres overlays (bottom sheets pequeños) que se disparan desde el Detalle de Incidencia
(Spec 06) y modifican el estado/asignación de una incidencia.

## 2. Overlay: Cambiar Estado

- RF-07.1: Muestra las transiciones válidas **desde el estado actual**. **Flujo
  confirmado con Edgar** (lineal, con un único loop en EN_PROGRESO — ver
  `docs/API.md` § 5 `GET /incidencias/{id}/transiciones-validas`):
  `CREADO → PENDIENTE → EN_PROGRESO → ATENDIDO`, con `EN_PROGRESO → EN_PROGRESO`
  como el único nombre de transición que importa de verdad ("Registrar avance", se
  puede repetir mientras sigue en progreso). El ejemplo del diseño ("Registrar avance
  → EN PROGRESO" / "Marcar como atendido → ATENDIDO") corresponde a una incidencia ya
  en EN_PROGRESO. Esta tabla de transiciones vive como datos planos, no como lógica
  embebida — Edgar planea un futuro portal web (tipo Jira) donde este workflow sea
  configurable desde un backend admin.
- RF-07.2: Tocar "Registrar avance" abre el overlay de Registrar Avance (§3). Tocar
  "Marcar como atendido" pide confirmación simple y cierra directo (no requiere
  formulario adicional).

## 3. Overlay: Registrar Avance

- RF-07.3: Lista de motivos de un solo select ("¿Qué pasó?"): Cuadrilla en sitio, Se
  resolvió, Requiere equipo, Derivar a otra área, Reasignar técnico, En espera,
  No se pudo atender.
- RF-07.4: Campo de nota opcional, texto libre, placeholder "Solo si hace falta un
  detalle extra...".
- RF-07.5: Botones "Cancelar" / "Registrar avance" (este último deshabilitado hasta
  elegir un motivo).
- RF-07.6: Al confirmar, se envía `POST /incidencias/{id}/avances` y se agrega un
  nuevo paso en la Trazabilidad (Spec 06) reflejado de inmediato (actualización
  optimista + invalidación de la query del detalle).
- RF-07.7: Si el motivo elegido es "Reasignar técnico", al confirmar se encadena
  automáticamente el overlay de Seleccionar Responsable (§4) — es la única motivo que
  requiere ese paso adicional.

## 4. Overlay: Seleccionar Responsable

- RF-07.8: Lista de técnicos/supervisores disponibles: avatar (iniciales sobre color),
  nombre, rol + cuadrilla/sector.
- RF-07.9: Selección única; al confirmar, `PATCH /incidencias/{id}/responsable` y
  actualiza el header del detalle (Spec 06, RF-06.1) sin recargar toda la pantalla.
- RF-07.10: Lista viene de `GET /usuarios?rol=tecnico,supervisor` — **confirmado con
  Edgar:** sin filtro por sector, siempre se muestra el pool completo de
  técnicos/supervisores (sin toggle "Ver todos", no hace falta).

## 5. Criterios de aceptación

1. Dado el estado "PENDIENTE", cuando se abre "Cambiar estado", entonces solo se
   muestran las transiciones válidas desde PENDIENTE.
2. Dado que el usuario elige motivo "Reasignar técnico" y confirma, cuando se cierra el
   formulario de avance, entonces se abre automáticamente el selector de responsable.
3. Dado que el usuario registra un avance con nota, cuando se confirma, entonces el tab
   Trazabilidad del detalle muestra el nuevo paso con la nota incluida.

---

## Solución implementada

- **Archivos:**
  - `src/mocks/estadoWorkflowMock.ts` — tabla de transiciones (`TRANSICIONES_ESTADO`,
    `getTransicionesDisponibles`) y catálogo de motivos (`MOTIVOS_AVANCE`), como datos
    planos (ver nota de "configurable a futuro" en RF-07.1).
  - `src/mocks/incidentOverridesStore.ts` — capa de mutación en memoria (`Map` por
    `id`): guarda estado/técnico/pasos de trazabilidad aplicados en esta sesión, ya
    que no hay backend real. `getIncidentDetail` (Spec 06) la consulta y la combina con
    los datos generados determinísticamente.
  - `src/hooks/useCambiarEstado.ts`, `useRegistrarAvance.ts`, `useReasignarResponsable.ts`
    — `useMutation` de React Query, invalidan `['incidencia-detalle', id]` al
    terminar (RF-07.6, RF-07.9: el detalle se actualiza sin recargar la pantalla).
  - `src/components/incident-actions/CambiarEstadoSheet.tsx`,
    `RegistrarAvanceSheet.tsx`, `SeleccionarResponsableSheet.tsx`.
  - `src/mocks/usuariosMock.ts` — ampliado con `rol` (técnico/supervisor) y alineado 1:1
    con el board Penpot `Overlay - Seleccionar Responsable` (Juan Gonzales Rubio, Luis
    Dominguez, María Paredes).
  - `src/app/incidencia/[id].tsx` (Spec 06) — coordina los 3 sheets y el encadenado
    RF-07.7.
- **Implementado de verdad:** los 3 overlays completos, incluyendo el encadenado
  "Reasignar técnico" → Seleccionar Responsable (RF-07.7), botón "Registrar avance"
  deshabilitado hasta elegir motivo (RF-07.5), y la Trazabilidad (Spec 06) reflejando
  cada acción de inmediato con fecha real, motivo y nota (RF-07.6, criterio de
  aceptación #3).
- **Alcance deliberadamente acotado:** las mutaciones solo afectan el detalle de esa
  incidencia (`useIncidentDetail`); el Mapa y la Lista (Specs 03/05) siguen mostrando
  el estado original del mock — propagar los cambios ahí requeriría un store global,
  fuera de alcance de "acciones sobre una incidencia".
- **Verificado:** `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform
  android` sin errores. No probado en emulador (misma limitación de entorno ya
  documentada en Specs 05/06).
- **Cómo probar:** desde el detalle de una incidencia "En progreso", cambiar estado,
  registrar avance con motivo "Reasignar técnico" y confirmar el encadenado al selector
  de responsable; verificar que el tab Trazabilidad muestra el nuevo paso con fecha de
  hoy, motivo y nota.
