# Spec 01 · Splash / Loader (GOTA)

**Estado:** ✅ Implementada
**Depende de:** `00-auditoria-diseno.md`
**Board Penpot de referencia:** `Loader`

## 1. Contexto

Primera pantalla que ve el usuario al abrir la app. Debe transmitir marca (GOTA =
Gestión Operacional, Trazabilidad y Atención de incidencias) mientras la app decide,
en segundo plano, a dónde navegar: a Login (si no hay sesión) o directo al Mapa
(si hay una sesión válida guardada).

## 2. Historia de usuario

> Como usuario de campo/oficina de EPSEL, al abrir la app quiero ver una pantalla de
> carga con la identidad de GOTA mientras la app verifica si ya tengo sesión iniciada,
> para no perder tiempo si ya inicié sesión antes.

## 3. Requisitos funcionales

- RF-01.1: Mostrar fondo degradado azul institucional, logo circular de gota, texto
  "GOTA" y el subtítulo "Gestión Operacional, Trazabilidad y Atención de incidencias".
- RF-01.2: Mientras se muestra, la app debe leer de forma asíncrona el almacenamiento
  seguro del dispositivo en busca de un token de sesión válido.
- RF-01.3: Navegación automática (sin interacción del usuario):
  - Si hay token válido (no expirado) → navega a `Mapa` (tab principal).
  - Si no hay token o expiró y no hay refresh token válido → navega a `Login`.
- RF-01.4: Tiempo mínimo en pantalla: 900 ms (evita parpadeo si la verificación de
  sesión es instantánea); tiempo máximo de espera antes de decidir: 3 s.

## 4. Requisitos no funcionales

- RNF-01.1: No debe hacer ninguna llamada de red — la verificación de sesión es local
  (SecureStore). La validación real del token contra el backend ocurre en la siguiente
  pantalla / al primer request, no aquí (mantiene el splash instantáneo y offline-safe).

## 5. Fuera de alcance

- Animaciones complejas del logo (el diseño no las especifica).

## 6. Criterios de aceptación

1. Dado que el usuario abre la app por primera vez (sin sesión guardada), cuando termina
   el splash, entonces se navega a Login.
2. Dado que el usuario ya inició sesión antes y el token guardado no está expirado,
   cuando termina el splash, entonces se navega directo al Mapa sin pedir login.
3. Dado que el token guardado expiró, cuando termina el splash, entonces se navega a
   Login (no se muestra el Mapa con una sesión inválida).

---

## Solución implementada

- **Archivos:** `src/app/index.tsx` (ruta raíz de Expo Router), `src/auth/session.ts`
  (lectura de sesión vía `expo-secure-store`).
- **Lógica:** `index.tsx` monta el gradiente/logo/texto (estático) y en un `useEffect`
  llama a `getStoredSession()`; usa `Promise.race` con un timeout de 3 s y calcula el
  tiempo restante hasta los 900 ms mínimos antes de resolver la navegación con
  `router.replace('/(app)/mapa')` o `router.replace('/login')`.
- **Colores:** gradiente `#0D2B52` → `#153C74` (`expo-linear-gradient`), coherente con
  la paleta de `00-auditoria-diseno.md`.
- **Verificado:** `npx tsc --noEmit`, `npx expo lint` y `npx expo export --platform
  android` (bundle de Metro) pasan sin errores. No se pudo verificar en un emulador
  real dentro de esta sesión (ver `docs/EMULADOR.md`); Edgar debe correrlo para
  confirmar el comportamiento visual.
- **Cómo probar:** borrar el almacenamiento de la app (o cerrar sesión desde el drawer)
  para ver la ruta a Login; iniciar sesión una vez y volver a abrir la app para ver la ruta
  directa al Mapa.
