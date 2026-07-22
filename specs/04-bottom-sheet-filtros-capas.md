# Spec 04 · Bottom Sheet: Filtros y Capas del mapa

**Estado:** ✅ Implementada
**Depende de:** `03-mapa-incidencias.md`
**Board Penpot de referencia:** `bottom-sheet-component` (`filter-content`,
`mask-content`), `Overlay - Filtros Incidencias`
**API relacionada:** `docs/API.md` § Incidencias (query params), § Catálogos

## 1. Contexto

Tercer elemento superpuesto del mapa (junto a menú y selector de tipo de mapa). Tiene
dos pestañas con propósitos distintos: **Filtros** (qué incidencias se muestran) y
**Capas** (qué infraestructura de red se dibuja sobre el mapa, independiente de las
incidencias).

## 2. Estados del componente

- **Compressed** (por defecto): barra baja con las dos pestañas "Filtros" / "Capas" y
  un handle para arrastrar hacia arriba.
- **Expandido**: ocupa hasta ~70% de la pantalla, muestra el contenido de la pestaña
  activa. Se cierra arrastrando hacia abajo o tocando fuera del sheet.

## 3. Requisitos funcionales — Tab "Filtros"

- RF-04.1: Selector de Ubicación (Distrito/Provincia, Sector) — dependiente
  (Sector se filtra según el Distrito elegido).
- RF-04.2: Chips exclusivos **Agua** / **Desagüe** (toggle, uno u otro o ambos —
  el diseño muestra a "Agua" seleccionado por defecto; se implementa como multi-select
  con al menos uno siempre activo).
- RF-04.3: Selectores "Tipo de atención" y "Estado" (listas dependientes de catálogo,
  ver `docs/API.md` § Catálogos).
- RF-04.4: Chips de prioridad: **A tiempo** (verde) / **Alerta** (amarillo) /
  **Crítica** (rojo) — multi-select.
- RF-04.5: Selector de rango de fechas (por defecto: fecha de hoy – fecha de hoy, ya
  que el mapa solo trae "incidencias de hoy" según Spec 03 RF-03.4; el usuario puede
  ampliarlo manualmente).
- RF-04.6: Botón "Aplicar filtros" — cierra el sheet y refresca los marcadores del
  mapa con los filtros elegidos. Botón "Limpiar" (arriba a la derecha) resetea todo a
  los valores por defecto.

## 4. Requisitos funcionales — Tab "Capas"

- RF-04.7: Mismo selector de Distrito/Provincia y Sector que en Filtros (controla qué
  tramos de red se piden al backend, evita traer la red de toda la región).
- RF-04.8: Grupo **Agua** (checkbox): Red potable, Válvulas, Grifos contra incendio.
- RF-04.9: Grupo **Desagüe** (checkbox, ver auditoría — renombrado desde
  "Alcantarillado"): Red primaria, Red secundaria, Buzones.
- RF-04.10: Botón "Ver en el mapa" — dibuja las capas de red seleccionadas como líneas
  sobre el mapa (no afecta los marcadores de incidencias, es una capa independiente).

## 5. Reglas de negocio

- Los filtros de la pestaña "Filtros" y las capas de "Capas" son independientes: se
  pueden combinar sin restricción.
- Los filtros aplicados persisten mientras la app está abierta (no se guardan entre
  sesiones — no estaba especificado y no es un dato sensible que valga la pena
  persistir; si se requiere, es un cambio menor a futuro).

## 6. Criterios de aceptación

1. Dado que el usuario selecciona solo "Desagüe" y prioridad "Crítica", cuando aplica
   filtros, entonces el mapa solo muestra pines rojos de incidencias de desagüe.
2. Dado que el usuario activa "Red potable" en Capas y toca "Ver en el mapa", entonces
   se dibuja la red de agua potable como líneas sobre el mapa sin ocultar los pines de
   incidencias.
3. Dado que el usuario toca "Limpiar", cuando se aplican filtros, entonces vuelve al
   estado por defecto (hoy, ambas categorías, todas las prioridades).

---

## Solución implementada

- **Archivos:**
  - `src/components/sheet/MapBottomSheet.tsx` — wrapper sobre `@gorhom/bottom-sheet`
    (snap points `14%`/`65%`) con las pestañas Filtros/Capas.
  - `src/components/sheet/FiltrosTab.tsx`, `src/components/sheet/CapasTab.tsx`.
  - `src/state/filtersStore.ts` — estado global (Zustand) de categorías/prioridades/modo
    de mapa, consumido por `useIncidentsToday` (Spec 03).
- **Implementado de verdad (filtra el mapa en vivo):** chips de Categoría (Agua/Desagüe)
  y Prioridad (A tiempo/Alerta/Crítica) — RF-04.2 y RF-04.4.
- **Simplificado / no conectado (documentado, no implementado en esta sesión):**
  - RF-04.1, RF-04.3, RF-04.5 (Distrito/Sector, Tipo de atención, Estado, Rango de
    fechas): se muestran como filas de solo lectura ("Chiclayo · Todos…", "Hoy") porque
    no existe el endpoint de catálogos (`docs/API.md` § 2) ni un `useCatalogos.ts` — no
    se construyó para no mockear un catálogo de distritos/sectores inventado sin que el
    usuario lo confirme.
  - RF-04.7–RF-04.10 (tab Capas): los checkboxes de Agua/Desagüe sí tienen estado local
    funcional, pero "Ver en el mapa" no dibuja nada sobre `MapView` — no hay geometría
    de red real ni mock creíble sin datos de EPSEL (ver `docs/API.md` § 7).
- **Verificado:** `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform
  android` sin errores. No probado en emulador dentro de esta sesión.
- **Cómo probar:** deslizar el sheet hacia arriba, cambiar de pestaña, desactivar el
  chip "Agua" y confirmar que el mapa solo deja los pines de Desagüe (clúster rojo).
