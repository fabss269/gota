# GOTA — EPSEL Móvil

App (React Native + Expo, TypeScript) para gestión operacional, trazabilidad y atención
de incidencias de agua y desagüe de EPSEL. Construida a partir del diseño en Penpot
siguiendo un proceso de **Spec-Driven Development**: ver `specs/`.

**La app corre como web responsive (PWA)**, no como build nativo — ver
`docs/ESTADO_PROYECTO.md` § 2 para el porqué y el detalle completo.

## Empezar aquí

1. **`docs/ESTADO_PROYECTO.md`** — léelo primero. Decisiones de infraestructura (por qué
   web y no nativo), bugs de compatibilidad ya resueltos y cómo se resolvieron, qué está
   verificado y qué no. Pensado para que cualquier persona o IA que retome el proyecto
   no tenga que reconstruir el contexto desde cero.
2. **`specs/00-auditoria-diseno.md`** — qué había en el diseño, qué se corrigió y por
   qué, y todas las decisiones de producto tomadas con Edgar.
3. **`specs/01` a `specs/09`** — una Spec por funcionalidad (contexto, requisitos,
   criterios de aceptación) con su sección **"Solución implementada"** documentando qué
   se construyó de verdad, qué se simplificó y por qué. **Las 9 specs están
   implementadas** (ver Estado dentro de cada una para el detalle/simplificaciones).
4. **`docs/API.md`** — contrato completo de API que necesita el backend (no existe
   todavía; la app corre sobre datos mock en `src/mocks/`).
5. **`docs/EMULADOR.md`** — cómo compilar nativo (Android Studio/EAS) si el proyecto
   retoma esa vía más adelante. No es el camino actual.

## Arranque rápido

```powershell
npm install
npx expo start --web
```

Login de prueba: `tecnico@epsel.gob.pe` / `epsel2026`.

## Estructura

```
src/
  app/            # rutas (Expo Router, file-based) — incluye login, (app)/ (Drawer:
                  # mapa/dashboard/incidencias) e incidencia/[id] (modal de detalle)
  auth/           # sesión + contexto de autenticación
  api/            # cliente HTTP (con refresh de token) — listo para el backend real
  mocks/          # datos simulados mientras no exista backend
  components/     # UI por dominio (map/, sheet/, dashboard/, incident-detail/,
                  # incident-actions/, incidents/) + PhoneFrame (frame responsive web)
  icons/          # íconos SVG propios (gota, alcantarilla)
  navigation/     # drawer de navegación
  state/          # estado global (Zustand)
  hooks/          # data-fetching (React Query) por pantalla/acción
  utils/          # clustering de incidencias para el mapa, etc.
  constants/      # paleta de colores, spacing (derivados de specs/00-auditoria-diseno.md)
assets/reference/ # PNG originales de íconos (solo referencia, no se usan en runtime)
specs/            # Specs SDD (una por funcionalidad)
docs/             # ESTADO_PROYECTO.md, API.md, EMULADOR.md
patches/          # patch-package — necesario para que react-native-web funcione (ver
                  # docs/ESTADO_PROYECTO.md § 3.1). No borrar ni saltarse `postinstall`.
```

## Comandos útiles

| Objetivo | Comando |
|---|---|
| Correr en web | `npx expo start --web` |
| Chequeo de tipos | `npx tsc --noEmit` |
| Lint | `npx expo lint` |
| Verificar que el bundle nativo empaqueta sin errores | `npx expo export --platform android` |
