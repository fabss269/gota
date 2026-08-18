# Estado del proyecto — contexto para cualquier IA/desarrollador

Este documento existe para que cualquier persona o agente de IA que retome este repo
entienda, sin tener que reconstruir el historial de conversación, **qué se hizo, por
qué, qué está probado y qué falta**. Complementa (no reemplaza) `specs/` — las specs
documentan requisitos y decisiones de producto por funcionalidad; este archivo documenta
el estado técnico general y las decisiones de arquitectura/infraestructura.

Última actualización: 2026-07-22.

## 1. Qué es GOTA

GOTA (Gestión Operacional, Trazabilidad y Atención de incidencias) es la app móvil de
EPSEL (empresa de agua/desagüe de Lambayeque, Perú) para que técnicos y supervisores
gestionen incidencias de agua/desagüe: verlas en un mapa, listarlas, ver el detalle de
una incidencia y actuar sobre ella (cambiar estado, registrar avance, reasignar
responsable), y un dashboard con métricas.

Construida con **Spec-Driven Development**: el diseño vive en un archivo de Penpot
(página `UI-MOVIL`), y cada funcionalidad tiene una spec en `specs/00` a `specs/09` con
una sección **"Solución implementada"** que documenta qué se construyó de verdad, qué se
simplificó y por qué. **Las 9 specs están `✅ Implementada`** — leer `specs/00-auditoria-diseno.md`
primero (decisiones de producto transversales) y luego la spec puntual antes de tocar
cualquier pantalla.

No existe backend todavía: la app corre contra datos simulados en `src/mocks/`, con el
contrato de API completo documentado en `docs/API.md` para cuando exista.

## 2. Decisión clave: la app es web-first, no nativa

**Esto es lo más importante que hay que saber antes de tocar código.** El proyecto
arrancó como una app React Native + Expo pensada para compilar nativamente
(Android/iOS). El 2026-07-22, tras fricción real y sostenida compilando nativo (errores
de instalación del SDK de Android Studio, falta de espacio en disco, sin Mac disponible
para iOS ni cuenta de Apple Developer), se decidió **pivotar a que la app corra como web
responsive, instalable como PWA** ("Agregar a pantalla de inicio" en Android/iPhone) en
vez de perseguir builds nativos.

Esto fue una decisión explícita, no un descarte silencioso del código nativo:
- El código nativo (`MapView.tsx`, etc.) **sigue intacto y sin tocar** — no se rompió
  nada a propósito, solo dejó de ser la prioridad.
- Se decidió explícitamente que el mapa en web usa un mapa **real e interactivo** con
  `maplibre-gl-js` (el SDK web del mismo proyecto MapLibre), no un placeholder.
- Se decidió explícitamente que todo debe verse y sentirse como una app móvil incluso en
  un navegador de escritorio ancho (ver § 4, "frame de teléfono").

**Cómo correr la app hoy:**

```powershell
npm install
npx expo start --web
```

`docs/EMULADOR.md` documenta cómo compilar nativo (Android Studio, emulador, EAS Build)
por si el proyecto retoma esa vía más adelante, pero **no es el camino actual** y puede
tener detalles desactualizados frente a este pivote.

## 3. Bugs de compatibilidad web reales, ya resueltos

Estos NO son specs de producto — son bugs de infraestructura/tooling que había que
resolver para que la app corriera en web en absoluto. Si algo similar reaparece
(un import "is not a function", un crash al desmontar, etc.), revisar aquí primero antes
de asumir que es un bug nuevo.

### 3.1. `react-native-web` no implementaba `codegenNativeComponent` / `codegenNativeCommands` / `TurboModuleRegistry`

**Síntoma:** `npx expo start --web` crasheaba en **todas** las rutas con
`(0, _reactNativeWebDistIndex.codegenNativeComponent) is not a function`, y luego con
`Cannot read properties of undefined (reading 'getEnforcing')`.

**Causa:** varias dependencias (`react-native-screens`, `react-native-gesture-handler`,
`react-native-reanimated`, `@maplibre/maplibre-react-native`) llaman estas funciones al
importarse (no condicionalmente), y `react-native-web` 0.21.2 no las exporta.

**Fix:** parche a `node_modules/react-native-web/dist/index.js` que agrega stubs
no-operativos de las tres, aplicado y persistido con **`patch-package`**
(`patches/react-native-web+0.21.2.patch` + `"postinstall": "patch-package"` en
`package.json`). **El directorio `patches/` debe estar commiteado** — sin él, cualquier
`npm install` fresco deja la app rota en web.

### 3.2. `expo-secure-store` no tiene implementación en web

**Síntoma:** `ExpoSecureStore.default.getValueWithKeyAsync is not a function` al cargar
la sesión guardada.

**Causa:** el build web de `expo-secure-store` es literalmente un objeto vacío `{}` — es
una API pensada solo para Keychain/Keystore nativo.

**Fix:** `src/auth/session.ts` tiene un branch `Platform.OS === 'web'` que usa
`localStorage` en vez de `SecureStore` para guardar/leer/borrar la sesión.

### 3.3. Mapa real en web con `maplibre-gl-js`

`@maplibre/maplibre-react-native` (el SDK nativo) no tiene build para web. Se creó
`src/components/map/MapView.web.tsx` — Metro lo resuelve automáticamente en web por la
convención `.web.tsx`, dejando `MapView.tsx` (nativo) intacto. Usa `maplibre-gl-js`
(`npm install maplibre-gl`) y monta el componente `IncidentMarker` real (no una
reimplementación) dentro de cada marker vía un root de `react-dom/client`, para que el
pin se vea idéntico al nativo (color por prioridad, glyph, badge de conteo). Click en un
marker navega a `/incidencia/[id]` igual que en nativo.

Dos gotchas de esta implementación, ya resueltos, que aplican a cualquier código futuro
similar:
- Asignar `ref.current = x` directamente en el cuerpo del render (no en un efecto)
  dispara el nuevo lint rule `react-hooks/refs` de React 19 — hacerlo siempre dentro de
  un `useEffect`.
- Desmontar un root de `react-dom/client` (`root.unmount()`) sincrónicamente dentro del
  cleanup de un efecto puede coincidir con que el árbol padre se esté desmontando al
  mismo tiempo, dando `Attempted to synchronously unmount a root while React was already
  rendering`. Fix: diferir con `queueMicrotask(() => root.unmount())` (ver
  `unmountRootSafely` en el archivo).

### 3.4. Formulario de login: input no controlado → controlado

`src/app/login.tsx` usaba `useForm` sin `defaultValues`, así que los `Controller` de
react-hook-form arrancaban con `value: undefined` y pasaban a string en el primer
tecleo, dando el warning clásico de React. Fix: `defaultValues: { correo: '', password: '' }`.

## 4. Layout responsive — "frame de teléfono"

`src/components/PhoneFrame.tsx` (nativo: no-op, pasa los children tal cual) +
`PhoneFrame.web.tsx` (real, envuelve el `return` raíz de `src/app/_layout.tsx`). Lógica:
usa `useWindowDimensions().width` — a 560px de ancho o menos (celular real, o la PWA ya
instalada) renderiza los children directo, sin frame, porque ya llena la pantalla; por
encima de 560px (navegador de escritorio) centra un recuadro tipo dispositivo (ancho
máximo 430px, alto `100vh` topado a 932px, bordes redondeados, sombra) sobre un fondo
oscuro.

Verificado que el Drawer, la pantalla modal de Detalle (`/incidencia/[id]`) y el
BottomSheet del Mapa quedan **correctamente contenidos** dentro del frame — ninguno usa
un portal a `document.body` en esta combinación de versiones, así que no hizo falta
ningún hack extra de contención.

## 5. Qué está verificado y qué no

**Verificado interactuando de verdad en el navegador** (no solo que compile): Login
(con las credenciales mock `tecnico@epsel.gob.pe` / `epsel2026`) → Mapa (markers +
navegación por click) → Dashboard (donut, línea, barras) → Incidencias (búsqueda,
filtros, paginación) → Detalle (las 4 pestañas: Detalle/Trazabilidad/Foco/Predio) → las
3 acciones de Spec 07 (Cambiar estado, Registrar avance —confirmado que agrega entrada a
la trazabilidad—, Reasignar responsable —confirmado que actualiza el asignado en vivo—)
→ Drawer → BottomSheet (arrastre para expandir, confirmando que gesture-handler +
reanimated funcionan en su fallback web).

**No verificado / abierto:**
- El click en un cluster del mapa con **más de una incidencia** dispara
  `Alert.alert(...)`, que en web cae a `window.alert()` (bloquea la UI de pruebas
  automatizadas) — nunca se probó ese camino específico.
- Un warning de Chrome (`[Intervention] Ignored attempt to cancel a touchmove event with
  cancelable=false...`) apareció al arrastrar/pellizcar el mapa **en un dispositivo
  táctil real**. Se confirmó que el CSS de `maplibre-gl` sí aplica `touch-action: none`
  correctamente en el canvas del mapa, así que la sospecha es que
  `react-native-gesture-handler` (que envuelve toda la app en `GestureHandlerRootView`
  para el Drawer/BottomSheet) instala listeners de touch más amplios que también
  intentan interceptar el gesto sobre el mapa. **Sin confirmar si esto rompe algo visual
  (ej. la página scrollea de fondo mientras se mueve el mapa) o es solo ruido de
  consola** — pendiente de que el usuario confirme el comportamiento visual real en su
  dispositivo antes de decidir si amerita un fix.
- La comparación contra Penpot fue visual/al ojo (Login y Detalle se ven correctos a
  simple vista), no un diff formal pantalla por pantalla contra cada board de Penpot.
- Ninguna versión **nativa** (Android/iOS) fue probada interactivamente en ningún
  momento de este proyecto — no hay emulador/dispositivo disponible en el entorno donde
  se ha trabajado. Todo lo nativo solo pasó por `tsc --noEmit` / `expo lint` /
  `expo export --platform android`.

## 6. Warnings de consola conocidos, dejados así a propósito

`"shadow*" style props are deprecated. Use "boxShadow"` y `props.pointerEvents is
deprecated` — vienen de patrones de estilo de React Native válidos en nativo
(`shadowColor`/`shadowOffset`/etc., prop `pointerEvents`) que `react-native-web` marca
como deprecados para web. Arreglarlos implicaría condicionar estilos por plataforma en
varios archivos solo para silenciar un warning cosmético de consola — no se hizo porque
no rompe nada funcionalmente. Si en algún momento se abandona el soporte nativo del
todo, ahí sí tendría sentido migrar a `boxShadow`/`style.pointerEvents` directamente.

`Disconnected from Metro (1006)` (y a veces un log suelto `"pt"` justo después) — es el
WebSocket de hot-reload de Metro cortándose (típicamente porque el proceso del dev
server se reinició). Se resuelve recargando la página; no es un bug de la app.

## 7. Archivos clave para orientarse rápido

| Qué | Dónde |
|---|---|
| Decisiones de producto/diseño transversales | `specs/00-auditoria-diseno.md` |
| Estado y "qué se implementó de verdad" por funcionalidad | `specs/01` a `specs/09` |
| Contrato de API para el futuro backend | `docs/API.md` |
| Cómo compilar nativo (Android Studio/EAS) — vía secundaria, no la actual | `docs/EMULADOR.md` |
| Este documento (contexto técnico/infra general) | `docs/ESTADO_PROYECTO.md` |
| Parche de `react-native-web` (§ 3.1) | `patches/react-native-web+0.21.2.patch` |
| Mapa web real | `src/components/map/MapView.web.tsx` |
| Frame responsive | `src/components/PhoneFrame.web.tsx` |
