/**
 * Setup global de Chart.js — registra sólo lo que usamos. Se importa una vez
 * desde cada componente de chart.
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

let registered = false;
export function ensureChartRegistered() {
  if (registered) return;
  Chart.register(
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    DoughnutController,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PieController,
    PointElement,
    Title,
    Tooltip,
    ChartDataLabels,
  );
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#334155';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.padding = 12;
  Chart.defaults.plugins.tooltip.padding = 8;
  // Datalabels apagados por default globalmente — cada chart los activa
  // explícitamente por tipo (pie → %, bar → valor). Sin este default, TODOS
  // los charts los mostrarían (incluidos line/point que no los quieren).
  (Chart.defaults.plugins as any).datalabels = { display: false };
  registered = true;
}

// ============================================================================
// Presets reutilizables — se pasan como `plugins.datalabels` en el options del
// chart individual. Alternativa a repetir la misma config 8 veces en cada
// componente.
// ============================================================================

/** Muestra el % dentro de cada slice de una torta/donut. `total` se pasa por
 * fuera (Chart.js no expone dataset.data sum trivialmente en el callback). */
export const pieDatalabelsPreset = {
  display: true,
  color: '#FFFFFF',
  font: { weight: 700 as const, size: 11 },
  textShadowBlur: 2,
  textShadowColor: 'rgba(0,0,0,0.35)',
  formatter: (value: number, ctx: any) => {
    const dataset = ctx.chart.data.datasets[ctx.datasetIndex]?.data ?? [];
    const total = dataset.reduce((s: number, v: number) => s + (Number(v) || 0), 0);
    if (!total) return '';
    const pct = (value / total) * 100;
    if (pct < 3) return '';   // esconde etiquetas microscópicas para no saturar
    return pct.toFixed(1).replace('.', ',') + '%';
  },
};

/** Muestra el valor numérico al extremo de cada barra (vertical u horizontal).
 * Se ubica con `anchor: 'end'` / `align: 'end'` para que quede fuera de la
 * barra, con formato es-PE. */
export const barValueDatalabelsPreset = {
  display: true,
  anchor: 'end' as const,
  align: 'end' as const,
  color: '#0D2B52',
  font: { weight: 700 as const, size: 10 },
  formatter: (value: number) => {
    if (value == null) return '';
    return Number(value).toLocaleString('es-PE');
  },
};
