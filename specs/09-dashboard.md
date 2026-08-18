# Spec 09 · Dashboard

**Estado:** ✅ Implementada (con los 4 KPIs de §2 deliberadamente en mock/espera — ver "Solución implementada")
**Depende de:** `08-navegacion-menu.md`
**Board Penpot de referencia:** `Dashboard`
**API relacionada:** `docs/API.md` § Dashboard

## 1. Contexto

Tercera sección del drawer. Panel de métricas para supervisión, no para atención
individual de incidencias (eso ya lo cubre Incidencias/Mapa).

## 2. Corrección de diseño aplicada (ver auditoría #3)

Las 4 tarjetas superiores del diseño ("Views 7,265 +11.01%", "Visits 3,671 -0.03%",
"New Users 256 +15.03%", "Active Users 2,318 +6.08%") son placeholder del kit de UI
genérico usado como base, en inglés y sin relación con el dominio de EPSEL. Se
reemplazan por 4 KPIs propuestos:

| KPI propuesto | Fuente |
|---|---|
| Incidencias abiertas (hoy) | `COUNT` incidencias con estado ≠ ATENDIDO, fecha = hoy |
| Incidencias críticas | `COUNT` incidencias con prioridad = Crítica y estado ≠ ATENDIDO |
| Tiempo promedio de atención | Promedio de (fecha ATENDIDO − fecha CREADO) del período |
| Cuadrillas activas | `COUNT` técnicos con al menos 1 incidencia EN PROGRESO |

> ⚠️ **Decisión explícita de Edgar (2026-07-21): estos 4 KPIs quedan en mock/espera.**
> No se confirmaron los propuestos arriba ni se definieron otros — a propósito, no por
> olvido. La fila de tarjetas se construyó (para no dejar el texto de plantilla en
> inglés del diseño original) pero corre sobre `KPI_CARDS_MOCK`
> (`src/mocks/dashboardMock.ts`), valores estáticos no calculados, con un aviso visible
> en la propia pantalla ("Valores de ejemplo — métricas pendientes de validar con
> negocio"). No conectar a datos reales sin retomar esta conversación primero.

También hay una fila de meses en inglés duplicada y oculta detrás de la fila en
español en el gráfico de línea (residuo del template) — se elimina, es puramente un
defecto de capas superpuestas sin intención de diseño.

## 3. Requisitos funcionales (elementos que sí estaban bien definidos)

- RF-09.1: Header con botón de menú.
- RF-09.2: 4 tarjetas KPI (contenido corregido, ver §2).
- RF-09.3: Donut "Tickets por categoría" — % Agua vs % Desagüe.
- RF-09.4: Línea de tiempo "Tickets" con toggle Agua/Desagüe, eje X en meses (español).
- RF-09.5: Barras horizontales "Top tipos de atención" (top 5 tipos por volumen).
- RF-09.6: Grid "Mapa esquemático de prioridad por sector" — cada celda representa un
  sector, coloreada verde/amarillo/rojo según antigüedad promedio de sus incidencias
  abiertas (leyenda: Verde ≤11d, Amarillo 11-22d, Rojo >22d — umbrales ya definidos en
  el diseño, se respetan tal cual).

## 4. Fuera de alcance

- Filtros de rango de fecha sobre el Dashboard completo (el diseño no los muestra;
  no se inventa un requisito que no está ni en el diseño ni en el pedido del usuario).

## 5. Criterios de aceptación

1. Dado datos mock cargados, cuando se abre el Dashboard, entonces las 4 tarjetas KPI
   muestran valores calculados (no texto en inglés de plantilla).
2. Dado el grid de prioridad por sector, cuando un sector tiene incidencias con más de
   22 días de antigüedad promedio sin atender, entonces su celda se pinta roja.

---

## Solución implementada

- **Archivos:**
  - `src/app/(app)/dashboard/index.tsx`
  - `src/components/dashboard/KpiRow.tsx`, `CategoryDonut.tsx`, `TicketsLineChart.tsx`,
    `TopTiposBarChart.tsx`, `PrioridadSectorGrid.tsx`.
  - `src/hooks/useDashboardMetrics.ts` — equivalente real: `GET /dashboard/resumen`
    (`docs/API.md` § 8).
  - `src/mocks/dashboardMock.ts` — KPIs mock (ver §2) + 3 funciones que calculan datos
    **reales** a partir de `INCIDENCIAS_ALL` (no mock): `getCategoriaSplit`,
    `getTopTipos`, `getPrioridadPorSector`. La serie mensual `SERIE_TICKETS` (RF-09.4)
    es ilustrativa — el mock de incidencias solo cubre ~40 días, no un año completo;
    mismo criterio que ya traía `docs/API.md` § 8 antes de esta sesión.
- **Corrección de rumbo sobre librería de gráficos:** el plan original de esta spec
  sugería `victory-native`. Edgar confirmó esa elección, pero se implementó por error
  con SVG a mano (`react-native-svg`, ya instalado) en vez de instalar la librería.
  Al notar la desviación, se le devolvió la decisión a Edgar con el costo real (nueva
  dependencia + probable `react-native-skia` + rebuild nativo no verificable sin
  emulador en este entorno) — **decidió mantener la versión a mano**. Migrar a
  victory-native queda como posibilidad futura si se necesitan animaciones/tooltips que
  el SVG a mano no da.
- **Implementado de verdad:** RF-09.1, RF-09.3 (donut real), RF-09.5 (barras reales),
  RF-09.6 (grid real, 4 sectores del mock en vez de las 27 celdas ilustrativas del
  diseño — no hay esa cantidad de sectores reales en los datos). RF-09.2 (KPIs) está
  construido visualmente pero con datos mock deliberados (ver §2). RF-09.4 (línea) está
  construida con toggle Agua/Desagüe real, sobre una serie ilustrativa.
- **Verificado:** `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform
  android` sin errores. No probado en emulador (misma limitación de entorno ya
  documentada en Specs 05-07).
- **Cómo probar:** entrar a Dashboard desde el drawer, cambiar el toggle Agua/Desagüe
  del gráfico de línea, y confirmar que el donut/barras/grid reflejan
  `INCIDENCIAS_ALL` (p.ej. cambiar datos del mock y recargar debería mover esos tres).
