# 00 · Auditoría del diseño Penpot (GOTA / EPSEL Móvil)

**Estado:** Referencia (no es una Spec ejecutable, alimenta a todas las demás)
**Fuente:** Archivo Penpot, página `UI-MOVIL`, conectado vía Penpot MCP Plugin.
**Fecha de auditoría:** 2026-07-20

## 1. Propósito

Este documento registra el inventario completo del diseño, las decisiones tomadas junto
con Edgar (SDD: decisiones = contrato, no se re-discuten spec por spec), y los defectos
de diseño detectados con su corrección. Cada Spec numerada (01, 02, 03…) referencia este
documento en vez de repetir el contexto.

## 2. Decisiones de producto (confirmadas con el usuario)

| Decisión | Valor elegido |
|---|---|
| Framework | **React Native + Expo** (TypeScript) |
| Alcance de esta iteración | **Diseño completo**: Mapa, Incidencias, Dashboard, modales de detalle/acciones |
| Backend | **No existe todavía.** Se diseña el contrato de API (`docs/API.md`) y la app corre contra un backend simulado (mock) mientras no exista uno real |
| Autenticación | Usuario/contraseña simple contra API propia → JWT (access + refresh), sesión persistida en el dispositivo para no volver a pedir login |
| Terminología del segundo tipo de incidencia | **"Desagüe"** (no "Alcantarillado", que solo aparecía en el panel de Capas) |
| Proveedor de mapas | **OpenStreetMap + MapLibre** (sin costo, sin API key) |
| Íconos de categoría (agua / desagüe) | Los archivos reales están en `OneDrive/Imágenes/EPSEL/gota.png` y `alcantarillado.png`, pero son ilustraciones tipo mascota (pin rojo + carita) que no combinan con el estilo plano del resto de la app y traen su propio color fijo, lo que rompe la codificación de color por criticidad. **Decisión:** reconstruir el glifo (gota / tapa de alcantarilla) como ícono SVG plano y monocromático, insertado dentro del pin de color existente (verde/amarillo/rojo) + contador. Los PNG originales se copian a `assets/reference/` solo como referencia visual, no se usan en producción. |

## 3. Inventario de pantallas/boards encontrados en Penpot

| Board | Uso | Estado |
|---|---|---|
| `Loader` | Splash "GOTA" | ✅ Listo, se usa tal cual |
| `Login` | Correo/Contraseña + Iniciar sesión | ⚠️ Placeholders "Typing string" en los inputs (residuo de Penpot, no es contenido real) |
| `Menu` | Mapa principal (vista "normal") | ✅ Real. Botón menú, botón tipo de mapa, bottom sheet, 3 `incident-marker` |
| `Menu - Mapa de Calor` | Variante de mapa con overlay de calor | ✅ Real, mismo layout base |
| `Menu - Mapa de Foco` | Variante de mapa con agrupación por foco/causa | ✅ Real, mismo layout base |
| `Overlay - Selector Mapa` | Popup para elegir Normal/Calor/Foco | ✅ Real |
| `bottom-sheet-component` (grupo `filter-content` + `mask-content`) | Bottom sheet con tabs **Filtros** / **Capas** | ✅ Real y muy completo (ver Spec 04) |
| `Incidencias` | Lista de incidencias con buscador, filtros y paginación | ✅ Real, bien resuelto |
| `Modal - Detalle Incidencia` / `Screen - Detalle Incidencia` | Detalle con tabs Detalle / Trazabilidad / Foco / Predio | ✅ Real, contenido rico (ver Spec 06) |
| `Modal - Detalle Incidencia - Predio/Foco/Trazabilidad` | Variantes de tab ya expandidas del mismo detalle | ✅ Real (redundantes con los tabs de arriba, se implementan como un solo componente con tabs) |
| `Overlay - Cambiar Estado` | Menú corto para pasar de estado | ✅ Real |
| `Overlay - Registrar Avance` | Formulario de motivo + nota | ✅ Real |
| `Overlay - Seleccionar Responsable` | Lista de técnicos para reasignar | ✅ Real |
| `Overlay - Filtros Incidencias` | Duplicado del tab "Filtros" del bottom sheet, aplicado a la lista de Incidencias | ✅ Real, mismo componente reutilizado |
| `nav-drawer` | Menú lateral (avatar, Mapa, Dashboard, Incidencias) | ⚠️ Ver hallazgo #2 |
| `Dashboard` | KPIs + gráficos | ⚠️ Ver hallazgo #3 |
| `Componentes` | Catálogo de componentes (Button, Checkbox, bottom-sheet, nav-drawer, navigation-button, navegación) | ℹ️ No es una pantalla, es la librería de referencia de componentes. Se usa como base para los componentes reutilizables de la app, no se implementa como screen. |
| `Chips / icon-selected`, `Selector / Hover`, `Block`, `headset-issue`, `header`, `section-card` (x2) | Piezas sueltas / partials usados dentro de otros boards | ℹ️ Se consumen como partes de las pantallas anteriores |

## 4. Defectos encontrados y corrección aplicada

1. **Color "Crítica" incorrecto.** El marcador de criticidad alta usaba `#9e5353` (marrón apagado), inconsistente con la leyenda del Dashboard ("Rojo") y con el estándar de alerta. **Corrección:** se usa `#D32F2F` (rojo semántico) para "Crítica" en toda la app, manteniendo `#34C759` (A tiempo / Verde) y `#FFCC00` (Alerta / Amarillo).
2. **`nav-drawer` con relleno de plantilla.** Tenía 3 ítems adicionales "Subtitle 1" con ícono de corazón sin relación con la app, y el usuario de ejemplo "Edgar Alarcon / Pasante Epsel" es dato hardcodeado. **Corrección:** se eliminan los 3 ítems de relleno; el drawer queda con Mapa, Dashboard, Incidencias y Cerrar sesión; el nombre/rol se carga desde la sesión autenticada.
3. **`Dashboard` con tarjetas KPI en inglés y sin relación con EPSEL** ("Views", "Visits", "New Users", "Active Users" — plantilla del kit "Dashboard UI Kit" sin editar). También hay una fila de textos de meses en inglés duplicados y ocultos detrás de los reales (residuo del template). **Corrección:** se reemplazan las 4 tarjetas KPI por métricas relevantes al dominio (Incidencias abiertas, Incidencias críticas, Tiempo promedio de atención, Cuadrillas activas). ⚠️ Estas 4 métricas son una **propuesta**, no vinieron definidas en el diseño ni las confirmó el usuario — quedan marcadas como pendientes de validación de negocio en la Spec 09.
4. **Placeholders de formulario reales ("Typing string").** Los campos de Login muestran literalmente el placeholder por defecto de Penpot. **Corrección:** se usan placeholders reales `correo@epsel.gob.pe` y `••••••••`.
5. **Terminología inconsistente "Alcantarillado" vs "Desagüe"** para la misma categoría — resuelto usando siempre "Desagüe" (decisión del usuario, sección 2).

## 5. Paleta de color derivada (no había Design Tokens definidos en Penpot)

| Token | Valor | Uso |
|---|---|---|
| `color.primary` | `#0D2B52` | Navy institucional (headers, botones primarios, splash) |
| `color.primary.dark` | `#062A5D` | Títulos de sección en Dashboard |
| `color.accent` | `#0152AC` | Enlaces, acentos de datos |
| `color.agua` | `#1565C0` (azul) | Categoría Agua |
| `color.desague` | `#8E24AA` (morado) | Categoría Desagüe |
| `color.status.a-tiempo` | `#34C759` | Criticidad baja / "A tiempo" |
| `color.status.alerta` | `#FFCC00` | Criticidad media / "Alerta" |
| `color.status.critica` | `#D32F2F` | Criticidad alta / "Crítica" (corregido, ver hallazgo #1) |
| `color.text.muted` | `#8B9BB8` | Ejes de gráfico, texto secundario |
| `color.text.body` | `#212121` | Texto de cuerpo |

## 6. No hay librería de tipografía/tokens Penpot

El archivo no define `Typography`/`Design Tokens` propios (las 691/1107/1381 componentes conectados son kits de íconos e ilustraciones de terceros: `styleui`, `Material-Design-Kit`, `Iconoir`, `Material-Design-Icons`, no contienen tokens de marca). La tipografía visible en capturas es un sans-serif estándar (similar a system font); se usa la fuente del sistema (San Francisco/Roboto) vía Expo por defecto — no se importa una tipografía custom porque no hay evidencia de una en el diseño.
