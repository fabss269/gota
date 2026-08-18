# Spec 08 · Menú de navegación (nav-drawer)

**Estado:** ✅ Implementada
**Depende de:** `02-autenticacion-sesion.md`
**Board Penpot de referencia:** `nav-drawer`
**API relacionada:** ninguna propia (consume datos de sesión)

## 1. Contexto

Drawer lateral que se abre desde el botón de menú disponible en Mapa (Spec 03) e
Incidencias (Spec 05). Es la navegación principal entre las 3 secciones de la app.

## 2. Corrección de diseño aplicada (ver auditoría #2)

El diseño original traía 3 ítems de relleno ("Subtitle 1" con ícono de corazón) sin
relación con la app, y el nombre "Edgar Alarcon / Pasante Epsel" hardcodeado. Se
eliminan los 3 ítems de relleno y el nombre/rol se carga desde la sesión autenticada.

## 3. Requisitos funcionales

- RF-08.1: Header del drawer: avatar (foto si existe, si no iniciales), nombre
  completo y rol del usuario autenticado (`useAuth().user`).
- RF-08.2: 3 ítems de navegación: **Mapa**, **Dashboard**, **Incidencias**, cada uno
  con su ícono (pin de ubicación, gráfico de barras, corazón → se reemplaza el ícono
  de corazón de "Incidencias" por uno más semántico, ej. ícono de alerta/reporte, ya
  que un corazón no comunica "incidencias" — corrección de criterio, no de contenido).
- RF-08.3: Resaltado del ítem correspondiente a la pantalla activa.
- RF-08.4: Ítem final "Cerrar sesión" (no existía en el diseño original, pero es
  requisito funcional directo de la Spec 02 RF-02.8 — sin este ítem no hay forma de
  cerrar sesión desde la UI).

## 4. Criterios de aceptación

1. Dado que el usuario está en Mapa, cuando abre el drawer, entonces el ítem "Mapa"
   aparece resaltado.
2. Dado que el usuario toca "Cerrar sesión", cuando confirma, entonces la sesión se
   borra y navega a Login.

---

## Solución implementada

- **Archivos:**
  - `src/app/(app)/_layout.tsx` — `Drawer` de `expo-router/drawer` (envuelve
    `@react-navigation/drawer`), con guard de sesión (`Redirect` a `/login` si no hay
    usuario autenticado).
  - `src/navigation/DrawerContent.tsx` — contenido custom del drawer (header con
    iniciales/nombre/rol, ítems, resaltado por ruta activa, cerrar sesión).
  - `src/navigation/openDrawer.ts` — helper `dispatch({ type: 'OPEN_DRAWER' })` usado
    por los botones de menú en Mapa/Dashboard/Incidencias.
- **Desviación del plan original:** no se creó `AppDrawer.tsx`; el layout de Expo Router
  (`(app)/_layout.tsx`) ya cumple ese rol directamente. Tampoco se importa
  `@react-navigation/native` ni `DrawerActions`: **desde el SDK 56, expo-router prohíbe
  esa importación** (falla el bundle de Metro con "expo-router is no longer compatible
  with react-navigation"). En su lugar, `openDrawer()` despacha la acción
  `{ type: 'OPEN_DRAWER' }` directamente sobre el objeto `navigation` que entrega
  `useNavigation()` de `expo-router`.
- **Dashboard/Incidencias en el drawer** navegan hoy a pantallas placeholder ("Próximamente",
  ver Specs 05 y 09), no a las pantallas completas del diseño.
- **Verificado:** `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform
  android` sin errores (incluye haber detectado y corregido el error real de
  compatibilidad de expo-router descrito arriba). No probado en emulador dentro de esta
  sesión.
- **Cómo probar:** abrir el drawer desde Mapa, navegar a Dashboard/Incidencias (stubs),
  y cerrar sesión desde el ítem final.
