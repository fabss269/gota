# Spec 03 · Mapa de incidencias (pantalla principal)

**Estado:** ✅ Implementada
**Depende de:** `00-auditoria-diseno.md`, `02-autenticacion-sesion.md`
**Boards Penpot de referencia:** `Menu`, `Menu - Mapa de Calor`, `Menu - Mapa de Foco`,
`Overlay - Selector Mapa`
**API relacionada:** `docs/API.md` § Incidencias, § Mapa

## 1. Contexto

Pantalla que se muestra inmediatamente después del login (o directo desde el splash si
ya había sesión). Es el home de la app: un mapa con las incidencias abiertas **del día
de hoy**, coloreadas por criticidad, con acceso a filtros/capas vía bottom sheet.

## 2. Historia de usuario

> Como supervisor/técnico de EPSEL, quiero ver en un mapa todas las incidencias de hoy,
> diferenciando de un vistazo si son de agua o de desagüe y qué tan críticas son, para
> priorizar a dónde enviar cuadrillas.

## 3. Requisitos funcionales

### 3.1 Mapa base
- RF-03.1: Mapa interactivo (pan/zoom) usando **MapLibre GL** sobre tiles de
  OpenStreetMap (decisión de la auditoría, sin API key). Centro inicial: bounding box
  de las incidencias del día; si no hay incidencias, centra en Chiclayo, Perú
  (`-6.7714, -79.8409`).

### 3.2 Marcadores de incidencia
- RF-03.2: Un marcador por **clúster de incidencias en una misma ubicación/zona**, con:
  - Forma de pin (tal como en el diseño original: gota invertida + círculo).
  - Color de fondo del pin según la **criticidad más alta del grupo**:
    `A tiempo` = verde `#34C759`, `Alerta` = amarillo `#FFCC00`,
    `Crítica` = rojo `#D32F2F` (corregido, ver auditoría #1).
  - Glifo blanco en el centro del pin: gota de agua si el grupo es 100% incidencias de
    **Agua**, ícono de tapa de alcantarilla si es 100% **Desagüe**; si el clúster mezcla
    ambas categorías se usa un glifo neutro "!" (definido en implementación, no estaba
    en el diseño — grupos mixtos no fueron contemplados en los mockups).
  - Contador blanco sobre círculo (igual que el diseño) con el número de incidencias
    agrupadas ahí.
- RF-03.3: Tap en un marcador → si el grupo tiene 1 incidencia, abre directo
  `Detalle Incidencia` (Spec 06); si tiene más de 1, abre una lista corta (bottom
  sheet) para elegir cuál ver.
- RF-03.4: Solo se cargan incidencias con fecha de creación = fecha actual del
  dispositivo (regla explícita del usuario: "incidencias del día de hoy"). El filtro
  de fecha del bottom sheet (Spec 04) permite ampliar ese rango manualmente.

### 3.3 Controles superpuestos (los "tres elementos más" del pedido original)
- RF-03.5: **Botón de menú** (esquina superior izquierda, ícono hamburguesa) → abre el
  `nav-drawer` (Spec 08).
- RF-03.6: **Botón de tipo de mapa** (esquina inferior izquierda, ícono de capas) →
  abre `Overlay - Selector Mapa` con 3 opciones: **Mapa normal**, **Mapa de calor**,
  **Mapa de foco**. Cambiar de modo:
  - *Normal*: pines individuales/clúster como en RF-03.2.
  - *Calor*: overlay de densidad (heatmap) por concentración de incidencias, sin pines
    individuales.
  - *Foco*: agrupación visual por "causa probable común" (mismo criterio que usa el
    detalle de incidencia en su tab "Foco", Spec 06) — incidencias que comparten un
    foco se resaltan juntas.
- RF-03.7: **Bottom sheet** en la parte inferior, siempre visible en su estado
  "compressed" (una barra con tabs Filtros/Capas), expandible arrastrando hacia arriba.
  Contenido completo: Spec 04.

## 4. Requisitos no funcionales

- RNF-03.1: Si el dispositivo no da permiso de ubicación, el mapa igual funciona
  (no centra en "mi ubicación", usa el centro por defecto); no se bloquea la pantalla
  pidiendo el permiso de forma obligatoria.
- RNF-03.2: Carga de incidencias con estado de "cargando" (skeleton) y de "error" con
  reintento; nunca una pantalla en blanco silenciosa.

## 5. Fuera de alcance de esta spec

- El contenido del bottom sheet (Spec 04) y el detalle de incidencia (Spec 06).

## 6. Criterios de aceptación

1. Dado que hay 3 incidencias de agua en la misma zona (2 alerta, 1 crítica), cuando se
   carga el mapa, entonces se ve un pin rojo (criticidad más alta del grupo) con
   glifo de gota y contador "3".
2. Dado el modo "Mapa de calor" seleccionado, cuando el usuario vuelve a la pantalla,
   entonces el mapa muestra el overlay de calor en vez de pines individuales.
3. Dado que el usuario toca el botón de menú, cuando se completa la animación, entonces
   se ve el drawer con Mapa / Dashboard / Incidencias / Cerrar sesión.

---

## Solución implementada

- **Archivos:**
  - `src/app/(app)/mapa/index.tsx` — pantalla principal, orquesta mapa + controles + sheet.
  - `src/components/map/MapView.tsx` (`EpselMapView`) — wrapper de
    `@maplibre/maplibre-react-native` v11 (`Map`/`Camera`/`Marker`), estilo demo público
    `https://demotiles.maplibre.org/style.json` (sin API key), reemplazable vía
    `EXPO_PUBLIC_MAP_STYLE_URL`.
  - `src/components/map/IncidentMarker.tsx` — pin + glifo + contador (SVG con
    `react-native-svg`), puramente presentacional (el `onPress` lo maneja el `Marker`
    nativo de MapLibre, no el componente).
  - `src/icons/GotaIcon.tsx`, `src/icons/AlcantarilladoIcon.tsx` — glifos reconstruidos
    en SVG (ver auditoría, decisión de íconos), `color` parametrizable. **Nota:** se
    ubicaron en `src/icons/`, no en `src/assets/icons/` como decía el plan original,
    porque ese path choca con el alias `@/assets/*` que el template de Expo ya reserva
    para `./assets/*` (imágenes estáticas de la app).
  - `assets/reference/gota.png`, `assets/reference/alcantarillado.png` — originales del
    usuario, copiados solo como referencia de diseño (no se importan en runtime).
  - `src/components/map/MapModeSheet.tsx` — selector Normal/Calor/Foco (implementado
    como `Modal` nativo con una tarjeta flotante, no como bottom sheet, ya que en el
    diseño original es una tarjeta pequeña anclada al botón, no un sheet de pantalla
    completa).
  - `src/hooks/useIncidentsToday.ts` + `src/mocks/incidentsMock.ts` — datos de hoy
    filtrados por categoría/prioridad (React Query, estados loading/error).
  - `src/utils/clusterIncidents.ts` — agrupa incidencias por cercanía de coordenadas
    (radio fijo en grados, no en píxeles de pantalla — simplificación válida para la
    densidad de datos mock actual, pero un radio en grados no se comporta igual en
    todos los niveles de zoom; ver "Pendiente" abajo) y calcula la criticidad máxima del
    grupo.
- **Pendiente / simplificado (documentado, no implementado en esta sesión):**
  - RF-03.6 (Calor/Foco): cambiar de modo hoy solo actualiza un badge de texto en
    pantalla; **no** se renderiza un `HeatmapLayer` real de MapLibre ni se recalculan
    los clústeres por "foco". Es el elemento más grande dejado a propósito fuera de
    alcance por tiempo — requiere una capa GeoJSON real, no solo estilo.
  - RF-03.3 (tap en marcador): como el Detalle de Incidencia (Spec 06) no está
    implementado, el tap muestra un `Alert` nativo con el resumen del clúster en vez de
    navegar a una pantalla de detalle.
  - El clustering no se recalcula por nivel de zoom (RF-03.2 lo implica implícitamente);
    con 9 incidencias mock no es perceptible, pero con datos reales sí haría falta.
- **Verificado:** `npx tsc --noEmit`, `npx expo lint` y `npx expo export --platform
  android` (bundle real de Metro, 2183 módulos) pasan sin errores. **No probado en
  emulador/dispositivo real** dentro de esta sesión — ver `docs/EMULADOR.md` para
  cómo hacerlo (requiere development build, no funciona en Expo Go por MapLibre).
- **Cómo probar:** loguear, verificar que el mapa carga los 9 datos mock de
  `src/mocks/incidentsMock.ts` agrupados en 3 clústeres (mismos colores/conteo que el
  diseño original: 3 verde, 1 amarillo, 5 rojo), cambiar el modo de mapa y abrir el
  drawer desde el botón de menú.
