# Cómo levantar la app (Windows)

## Punto importante primero: no alcanza con "Expo Go"

La app usa **MapLibre** (`@maplibre/maplibre-react-native`) para el mapa, que es un
módulo nativo. La app genérica **Expo Go** (la que se descarga de Play Store para
previsualizar proyectos Expo) **no trae este módulo instalado**, así que el mapa no
va a funcionar ahí. Hace falta generar un **development build** propio (una versión de
la app que sí incluye MapLibre compilado) — es un paso único, después se recarga en
caliente igual que con Expo Go normalmente.

## Opción recomendada: Android Studio + emulador Android

Es la mejor opción en Windows (no hay Mac disponible para iOS Simulator, que además no
existe para Windows de todas formas).

### 1. Instalar Android Studio

1. Descargar e instalar [Android Studio](https://developer.android.com/studio).
2. Al abrirlo por primera vez, el asistente ("More Actions" → "SDK Manager" si ya lo
   cerraste) instala automáticamente el Android SDK. Confirma que quede instalado:
   - Android SDK Platform (la versión más reciente, hoy Android 15 / API 35).
   - Android SDK Build-Tools.
   - Android Emulator.
   - Android SDK Platform-Tools (trae `adb`).

### 2. Crear un emulador (AVD)

1. En Android Studio: **More Actions → Virtual Device Manager** (o el ícono de celular
   en la barra de herramientas si tienes un proyecto abierto).
2. **Create Device** → elige un teléfono de gama media-alta (ej. **Pixel 8**) → Next.
3. Elige una imagen de sistema con **Google Play** (no "Google APIs" solo — con Play
   Store es más parecido a un teléfono real) — recomendado: la versión más reciente
   estable (API 34/35). Descárgala si hace falta.
4. Finish. Desde el Virtual Device Manager, dale ▶ para arrancarlo una vez y confirmar
   que bootea bien (puede tardar unos minutos la primera vez).

### 3. Configurar variables de entorno

Agrega estas variables de entorno de usuario en Windows (Panel de control → Sistema →
Configuración avanzada del sistema → Variables de entorno), o en PowerShell:

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx Path "$env:Path;$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

Cierra y vuelve a abrir la terminal para que tomen efecto. Verifica con:

```powershell
adb --version
```

### 4. Generar el development build y correr la app

Desde la carpeta del proyecto (`D:\EPSEL-MOVIL`), con el emulador ya abierto:

```powershell
npm install
npx expo run:android
```

La primera vez esto compila el proyecto Android nativo (puede tardar varios minutos,
descarga Gradle/dependencias). Al terminar, instala la app en el emulador y la deja
corriendo con Metro conectado — desde ahí, guardar un archivo recarga la app al
instante (Fast Refresh), igual que con Expo Go.

En corridas siguientes, ya no hace falta recompilar todo: alcanza con

```powershell
npx expo start --dev-client
```

y elegir el emulador desde el menú de Metro (tecla `a`).

## Alternativa: dispositivo Android físico

Si tienes un celular Android a mano, es más rápido que un emulador:

1. Activa "Opciones de desarrollador" → "Depuración USB" en el teléfono.
2. Conéctalo por USB, acepta el permiso de depuración.
3. `adb devices` debe listarlo.
4. `npx expo run:android` lo detecta automáticamente e instala ahí en vez de un
   emulador.

## Alternativa: EAS Build (sin instalar Android Studio)

Si no quieres instalar Android Studio localmente, Expo puede compilar el development
build en la nube:

```powershell
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Esto genera un `.apk` descargable para instalar en cualquier celular Android (o en un
emulador) sin compilar nada localmente — requiere una cuenta gratuita de Expo (EAS
tiene una cuota gratuita mensual de builds).

## iOS

No es posible compilar ni emular iOS desde Windows (Xcode solo corre en macOS). Si más
adelante hace falta iOS, las opciones son: `eas build --platform ios` (build en la nube
de Expo, no requiere Mac) para generar un build instalable vía TestFlight, o acceso a
una Mac física/virtual para usar el iOS Simulator.

## Resumen rápido

| Objetivo | Comando |
|---|---|
| Primera vez / después de instalar una librería nativa nueva | `npx expo run:android` |
| Seguir desarrollando (ya generado el build) | `npx expo start --dev-client` |
| Ver que el JS compila y empaqueta sin errores (sin emulador) | `npx expo export --platform android` |
| Chequeo de tipos | `npx tsc --noEmit` |
| Lint | `npx expo lint` |
