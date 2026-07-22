# Spec 05 · Lista de Incidencias

**Estado:** ✅ Implementada
**Depende de:** `00-auditoria-diseno.md`, `08-navegacion-menu.md`
**Board Penpot de referencia:** `Incidencias`
**API relacionada:** `docs/API.md` § Incidencias

## 1. Contexto

Segunda entrada del drawer de navegación. Vista en lista (no mapa) de todas las
incidencias, pensada para buscar/filtrar por texto y prioridad/estado, con paginación.
Es la pantalla mejor resuelta del diseño original: se implementa prácticamente tal
cual, sin correcciones de fondo.

## 2. Requisitos funcionales

- RF-05.1: Header con botón de menú (abre drawer) y título "Incidencias".
- RF-05.2: Buscador de texto libre con placeholder "Buscar por tipo (ej. Atoro en
  colector)" — busca por tipo de incidencia y dirección (`docs/API.md` define el
  parámetro `q`).
- RF-05.3: Chips desplegables "Prioridad" y "Estado" (multi-select) + botón
  "Más filtros" que abre el mismo overlay de Filtros de la Spec 04 (`Overlay - Filtros
  Incidencias` es el mismo componente reutilizado, según auditoría §3).
- RF-05.4: Cada fila de la lista muestra: ícono de estado (punto de color según
  prioridad: verde/amarillo/rojo/gris — el gris corresponde a estado "Creado", sin
  asignar aún), tipo de incidencia (título), dirección + sector, estado textual
  (p.ej. "En progreso", "Crítica · Pendiente", "Atendido").
- RF-05.5: Tap en una fila → navega a `Detalle Incidencia` (Spec 06).
- RF-05.6: Paginación numerada al final de la lista (según diseño: `< 1 2 3 >`),
  10 incidencias por página (valor por defecto, configurable).
- RF-05.7: A diferencia del Mapa (que solo trae "hoy"), esta lista **no** filtra por
  fecha por defecto — muestra todo, y el usuario puede acotar por fecha desde
  "Más filtros" si lo necesita.

## 3. Criterios de aceptación

1. Dado que el usuario escribe "atoro" en el buscador, cuando espera el debounce (300
   ms), entonces la lista solo muestra incidencias cuyo tipo contiene "atoro".
2. Dado que hay más de 10 resultados, cuando se carga la lista, entonces se muestra la
   paginación y cambiar de página trae la siguiente tanda desde la API.
3. Dado que el usuario toca una fila, cuando navega, entonces llega al detalle de esa
   incidencia específica (mismo `id`).

---

## Solución implementada

- **Archivos:**
  - `src/app/(app)/incidencias/index.tsx` — pantalla completa (header, buscador,
    chips, lista, paginación).
  - `src/components/incidents/IncidentListItem.tsx`, `SearchBar.tsx`,
    `ChipMultiSelect.tsx`, `FiltersRow.tsx`, `FiltersOverlay.tsx`, `Pagination.tsx`.
  - `src/hooks/useIncidentsList.ts` — React Query con `keepPreviousData` (paginación
    sin parpadeo); equivalente real: `GET /incidencias?q=&prioridad=&estado=&page=`
    (`docs/API.md` § 3).
  - `src/state/incidentsListFiltersStore.ts` — store propio (Zustand), separado del
    `filtersStore.ts` del Mapa porque el overlay "Más filtros" tiene secciones que el
    Mapa no tiene (Estado, Red asociada, Asignado, Sector).
  - `src/mocks/incidentsMock.ts` — se agregó `INCIDENCIAS_HISTORICO` (19 registros con
    fechas de días previos, inventados) y se exporta `INCIDENCIAS_ALL` (hoy +
    historial), porque RF-05.7 exige que la lista no filtre por fecha por defecto y el
    mock de "hoy" (Spec 03) no alcanzaba para probar paginación real.
- **Implementado de verdad:** buscador con debounce de 300 ms (RF-05.2), chips
  "Prioridad"/"Estado" (RF-05.3), overlay completo "Más filtros" con las 5 secciones
  del diseño (Prioridad, Estado, Red asociada, Asignado, Sector — RF-05.3), fila con
  punto de color por prioridad/gris para "Creado" (RF-05.4), paginación real de 10 por
  página (RF-05.6), sin filtro de fecha por defecto (RF-05.7).
- **Simplificado / no conectado (documentado, no implementado en esta sesión):**
  - Opción "Mi cuadrilla" del filtro "Asignado": deshabilitada — el usuario
    autenticado (mock, `src/auth/session.ts`) no trae un campo de cuadrilla propia, y
    no hay endpoint real (`docs/API.md` § 6) para resolverlo sin inventar el dato
    (decisión confirmada con Edgar).
  - Tap en una fila (RF-05.5): como el Detalle de Incidencia (Spec 06) no está
    implementado todavía, muestra un `Alert` con tipo/dirección/sector — mismo
    criterio de placeholder usado en el Mapa (Spec 03) para clústeres.
- **Cómo probar:** entrar por el drawer a "Incidencias", buscar "fuga" (con debounce),
  togglear los chips de Prioridad/Estado, abrir "Más filtros" y combinar Sector +
  Asignado "Sin asignar", cambiar de página y tocar un resultado.
