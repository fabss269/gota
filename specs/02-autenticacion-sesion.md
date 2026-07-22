# Spec 02 · Autenticación y persistencia de sesión

**Estado:** ✅ Implementada (contra mock; pendiente de swap a backend real)
**Depende de:** `00-auditoria-diseno.md`
**Board Penpot de referencia:** `Login`
**API relacionada:** `docs/API.md` § Auth

## 1. Contexto

Login con correo/contraseña. El requisito explícito del usuario es que **solo se pida
la primera vez**: una vez autenticado, la sesión se guarda en el dispositivo y las
siguientes aperturas de la app van directo al Mapa (ver Spec 01, RF-01.3).

## 2. Historia de usuario

> Como usuario de EPSEL, quiero iniciar sesión una sola vez con mi correo y contraseña,
> y que la app recuerde mi sesión, para no tener que loguearme cada vez que abro la app.

## 3. Requisitos funcionales

- RF-02.1: Formulario con campo Correo (teclado tipo email, sin autocapitalización) y
  Contraseña (oculta por defecto, ícono de ojo para mostrar/ocultar — tal como en el
  diseño).
- RF-02.2: Validación de cliente antes de enviar: correo con formato válido, contraseña
  no vacía. Mostrar error inline debajo del campo, no un alert genérico.
- RF-02.3: Al enviar, llamar `POST /auth/login`. Éxito → guardar `accessToken`,
  `refreshToken` y datos básicos del usuario (`nombre`, `rol`) en almacenamiento
  seguro (`expo-secure-store`), y navegar a Mapa.
- RF-02.4: Error de credenciales (401) → mensaje "Correo o contraseña incorrectos"
  debajo del botón, sin indicar cuál de los dos campos es el incorrecto (buena
  práctica de seguridad, evita enumeración de usuarios).
- RF-02.5: Error de red → mensaje "No se pudo conectar. Verifica tu conexión." con
  botón de reintentar.
- RF-02.6: Botón "Iniciar sesión" se deshabilita mientras la petición está en curso y
  muestra un spinner (evita doble submit).
- RF-02.7: **Renovación de sesión:** cualquier request autenticado que reciba 401 debe
  intentar `POST /auth/refresh` una vez con el `refreshToken` guardado; si también
  falla, se limpia la sesión y se redirige a Login.
- RF-02.8: Debe existir una acción "Cerrar sesión" (se ubica en el `nav-drawer`, ver
  Spec 08) que borra el token guardado y navega a Login.

## 4. Requisitos no funcionales

- RNF-02.1: Los tokens se guardan **solo** con `expo-secure-store` (Keychain/Keystore
  nativo), nunca en `AsyncStorage` ni en memoria persistida sin cifrar.
- RNF-02.2: La contraseña nunca se guarda en el dispositivo, solo se envía en el
  request de login.

## 5. Corrección de diseño aplicada

Ver hallazgo #4 de la auditoría: los inputs mostraban literalmente "Typing string"
(residuo de Penpot). Se reemplaza por placeholders reales: `correo@epsel.gob.pe` y
`••••••••`.

## 6. Criterios de aceptación

1. Dado credenciales válidas, cuando el usuario presiona "Iniciar sesión", entonces
   navega al Mapa y la sesión queda persistida.
2. Dado credenciales inválidas, cuando el usuario presiona "Iniciar sesión", entonces
   se muestra "Correo o contraseña incorrectos" y el usuario permanece en Login.
3. Dado que no hay conexión, cuando el usuario presiona "Iniciar sesión", entonces se
   muestra el mensaje de error de red con opción de reintentar.
4. Dado que el usuario cierra sesión desde el menú, cuando vuelve a abrir la app,
   entonces se le pide login de nuevo (Spec 01, criterio 1).

---

## Solución implementada

- **Archivos:**
  - `src/app/login.tsx` — pantalla y formulario (React Hook Form + Zod para validación).
  - `src/auth/session.ts` — `saveSession`, `getStoredSession`, `clearSession`,
    `isSessionExpired` sobre `expo-secure-store`.
  - `src/auth/AuthContext.tsx` — contexto de React con `user`, `isAuthenticated`,
    `signIn`, `signOut`, usado por `(app)/_layout.tsx` (guard de rutas) y el drawer.
  - `src/api/client.ts` — `apiFetch()` con interceptor de 401 → refresh → reintento
    (implementa RF-02.7). **Todavía no está conectado a ninguna pantalla** (todo corre
    sobre `signIn()` → `mockLogin()` directo); queda listo como el único punto de
    cambio para conectar un backend real.
  - `src/mocks/authMock.ts` — usuario mock (`tecnico@epsel.gob.pe` / `epsel2026`) usado
    mientras no exista backend real (ver `00-auditoria-diseno.md` — decisión de backend).
- **Desviación del plan original:** no se creó `src/api/auth.ts` como archivo separado;
  `AuthContext.signIn` llama a `mockLogin` directamente. Es una simplificación válida
  mientras todo es mock — al conectar el backend real, ese es el punto a reemplazar por
  `apiFetch('/auth/login', ...)`.
- **Verificado:** `npx tsc --noEmit`, `npx expo lint` y `npx expo export --platform
  android` pasan sin errores. Pendiente de probar en dispositivo/emulador real (ver
  `docs/EMULADOR.md`).
- **Cómo probar:** loguear con `tecnico@epsel.gob.pe` / `epsel2026`; probar credenciales
  incorrectas para ver el mensaje de error; cerrar sesión desde el drawer y confirmar
  que vuelve a pedir login.
