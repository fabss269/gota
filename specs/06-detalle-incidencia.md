# Spec 06 · Detalle de Incidencia

**Estado:** ✅ Implementada
**Depende de:** `03-mapa-incidencias.md`, `05-lista-incidencias.md`
**Boards Penpot de referencia:** `Modal - Detalle Incidencia`,
`Screen - Detalle Incidencia`, `Modal - Detalle Incidencia - Predio/Foco/Trazabilidad`
**API relacionada:** `docs/API.md` § Incidencias / Detalle

## 1. Contexto

Se accede desde un marcador del mapa (Spec 03) o desde una fila de la lista (Spec 05).
El diseño tiene el mismo contenido duplicado como "Modal" (para abrir desde el mapa,
flotando sobre él) y como "Screen" completa (para abrir desde la lista). **Decisión de
implementación:** un solo componente de detalle, presentado como modal en ambos casos
por consistencia y para no duplicar código — la diferencia entre "Modal" y "Screen" en
el diseño no aporta una diferencia funcional real.

## 2. Estructura: 4 tabs

1. **Detalle** (tab por defecto)
2. **Trazabilidad**
3. **Foco**
4. **Predio**

## 3. Requisitos funcionales

### Header (común a los 4 tabs)
- RF-06.1: Tipo de incidencia (p.ej. "Fuga de agua"), botón de cerrar, dirección,
  badge de prioridad (color + texto: A tiempo/Alerta/Crítica), antigüedad en días,
  estado textual (p.ej. "EN PROGRESO"), avatar+nombre del técnico asignado con acceso
  a "Reasignar responsable" (Spec 07).

### Tab Detalle
- RF-06.2: **Datos del reclamo:** fecha de registro, medio de recepción, canal (solo
  aparece en la versión "Screen" del diseño — se incluye siempre, es más información,
  no menos), descripción libre.
- RF-06.3: **Datos del catastro:** red asociada, diámetro, material, buzón cercano
  (código + cota), sector.
- RF-06.4: Resumen de agrupación: número de quejas agrupadas con acceso rápido a la
  lista de reclamos agrupados ("Ver los 5 reclamos →").

### Tab Trazabilidad
- RF-06.5: Línea de tiempo vertical de cambios de estado: CREADO → PENDIENTE →
  EN PROGRESO → ATENDIDO, cada paso con fecha/hora, y metadatos opcionales (grupo
  asignado, técnico + cuadrilla, nota). El paso futuro no alcanzado se muestra atenuado
  (p.ej. "ATENDIDO — Pendiente").

### Tab Foco
- RF-06.6: Texto de "posible causa común" y lista de otras incidencias asociadas al
  mismo foco (tipo, dirección/sector, estado) — permite saltar al detalle de cualquiera
  de ellas.

### Tab Predio
- RF-06.7: Histórico de reclamos del mismo predio/dirección (tipo + número de reclamo +
  fecha), con el resumen "N quejas en 6 meses" ya visto en el header.

### Acciones
- RF-06.8: Acceso a "Cambiar estado" y "Registrar avance" (Spec 07) desde el header o
  un botón de acción flotante — el diseño no especifica la posición exacta del
  disparador, se ubica en el header junto al estado (decisión de implementación).

## 4. Criterios de aceptación

1. Dado un `id` de incidencia, cuando se abre el detalle, entonces se pre-carga el tab
   "Detalle" con toda la data del RF-06.2/06.3.
2. Dado que el usuario cambia al tab "Trazabilidad", cuando se renderiza, entonces se
   ve el historial completo ordenado cronológicamente.
3. Dado que el usuario toca una incidencia listada en el tab "Foco", cuando navega,
   entonces se abre el detalle de esa otra incidencia (misma pantalla, otro `id`).

---

## Solución implementada

- **Archivos:**
  - `src/app/incidencia/[id].tsx` — modal ruteado. **Desviación deliberada de la ruta
    sugerida** (`app/(app)/incidencia/[id].tsx`): se colocó FUERA del grupo `(app)`
    (Drawer), como hijo directo del `Stack` raíz (`src/app/_layout.tsx`,
    `options={{ presentation: 'modal' }}`) — dentro del grupo `(app)` habría quedado
    absorbida por el Drawer como una pestaña más en vez de presentarse como modal real
    sobre cualquier tab.
  - `src/components/incident-detail/IncidentDetailHeader.tsx`, `TabsBar.tsx`,
    `DetalleTab.tsx`, `TrazabilidadTab.tsx`, `FocoTab.tsx`, `PredioTab.tsx`.
  - `src/hooks/useIncidentDetail.ts` — equivalente real: `GET /incidencias/{id}` +
    `GET /incidencias/{id}/trazabilidad` combinados (`docs/API.md` § 4).
  - `src/mocks/incidentDetailMock.ts` — generador determinístico (`getIncidentDetail`,
    hash por `id`, sin `Math.random`) que deriva reclamo/catastro/foco/predio/
    trazabilidad/técnico para **cualquiera de las 28 incidencias** de
    `INCIDENCIAS_ALL` (Spec 05), no solo un par de ejemplos — decisión confirmada con
    Edgar para que cualquier fila del Mapa/Lista sea tocable con un resultado
    coherente.
  - `src/mocks/usuariosMock.ts` — pool de 3 técnicos (antes solo existía el usuario de
    login) para variedad real en "Técnico asignado".
  - `src/utils/formatFecha.ts` — formato de fecha/hora compartido entre tabs.
  - Se reemplazaron los `Alert.alert` placeholder de Mapa (Spec 03) y Lista (Spec 05)
    por navegación real a esta ruta — confirmado con Edgar.
- **Implementado de verdad:** los 4 tabs con toda su data (RF-06.1 a RF-06.7); tab Foco
  navega a otra incidencia real del mismo sector+categoría (hasta 3, vía
  `INCIDENCIAS_ALL`); tab Predio muestra histórico sintético coherente con
  `quejasUltimos6Meses`; criterio de aceptación #3 (saltar de Foco a otro detalle)
  funciona con `router.push` (nueva entrada en el stack, no reemplaza).
- **Simplificado / no conectado (documentado, no implementado en esta sesión):**
  - "Cambiar estado" (tap en el chip de estado) y "Reasignar responsable" (tap en la
    fila del técnico) — Spec 07 no implementada, muestran un `Alert` explicando que
    está pendiente, mismo criterio que otros placeholders del proyecto.
  - "Ver los N reclamos →" (RF-06.4): no hay pantalla ni endpoint definido para la
    lista completa de reclamos agrupados (`docs/API.md` § 4 solo expone el conteo) —
    el link muestra un `Alert` en vez de navegar. Los reclamos agrupados que sí se
    listan (hasta 3) son sintéticos, no incidencias reales navegables (a diferencia de
    Foco, que si usa incidencias reales).
  - Cluster del Mapa con más de 1 incidencia: sigue mostrando el `Alert` resumen
    anterior (no hay UI de desambiguación diseñada para elegir cuál abrir); solo los
    clústeres de 1 incidencia navegan directo al detalle.
- **Verificado:** `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform
  android` (2202 módulos) sin errores. No probado en emulador — ver limitación de
  entorno ya documentada (sin Android Studio disponible; `expo start --web` falla por
  incompatibilidad nativa preexistente ajena a este cambio).
- **Cómo probar:** abrir una incidencia desde el mapa (clúster de 1) y otra desde la
  lista, navegar entre los 4 tabs, y saltar a otra incidencia desde el tab "Foco" (solo
  aparece cuando hay otras incidencias del mismo sector+categoría en el mock).
