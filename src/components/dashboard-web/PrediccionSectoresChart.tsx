import { Bar } from 'react-chartjs-2';

import { makeBarValueLabelsPlugin } from '@/components/dashboard-web/barValueLabelsPlugin';
import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { Colors } from '@/constants/theme';
import { usePrediccionSectores } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const valueLabels = makeBarValueLabelsPlugin((n) => n.toFixed(1));

const COLOR_TENDENCIA: Record<string, string> = {
  creciente: Colors.statusCritica,
  decreciente: Colors.statusATiempo,
  estable: Colors.textMuted,
};

const ETIQUETA_TENDENCIA: Record<string, string> = {
  creciente: '↑ Creciente',
  decreciente: '↓ Decreciente',
  estable: '→ Estable',
};

type Row = {
  sectorid: number;
  sector: string;
  tendencia: string;
  pred_proximo_mes: number;
  cambio_pct_mensual: number;
};

const COLUMNAS: ChartTableColumn<Row>[] = [
  { header: 'Sector', render: (r) => r.sector.replace('CHICLAYO - ', '') },
  { header: 'Previsto', align: 'right', render: (r) => r.pred_proximo_mes.toFixed(1) },
  { header: 'Tendencia', align: 'right', render: (r) => `${ETIQUETA_TENDENCIA[r.tendencia] ?? r.tendencia} (${r.cambio_pct_mensual.toFixed(1)}%/mes)` },
];

/** Predicción de sectores en riesgo (regresión lineal simple, 6 meses de
 * lookback) — barra horizontal ordenada por volumen previsto, coloreada por
 * tendencia para lectura ejecutiva rápida. Sin modo torta: la métrica es una
 * predicción/tendencia, no una proporción de un total. */
export function PrediccionSectoresChart() {
  const { data, isLoading } = usePrediccionSectores(6);
  const rows = [...(data ?? [])]
    .sort((a, b) => b.pred_proximo_mes - a.pred_proximo_mes)
    .slice(0, 10);

  const chartData = {
    labels: rows.map((r) => r.sector.replace('CHICLAYO - ', '')),
    datasets: [
      {
        label: 'Predicción próximo mes',
        data: rows.map((r) => r.pred_proximo_mes),
        backgroundColor: rows.map((r) => COLOR_TENDENCIA[r.tendencia] ?? Colors.textMuted),
        borderRadius: 4,
      },
    ],
  };

  const options: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 36 } },
    scales: {
      x: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      y: { grid: { display: false } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const row = rows[ctx.dataIndex];
            return [
              ` Previsto: ${row.pred_proximo_mes.toFixed(1)}`,
              ` Tendencia: ${ETIQUETA_TENDENCIA[row.tendencia] ?? row.tendencia} (${row.cambio_pct_mensual.toFixed(1)}%/mes)`,
            ];
          },
        },
      },
      datalabels: {
        display: true,
        anchor: 'end' as const,
        align: 'right' as const,
        color: '#0D2B52',
        font: { weight: 700 as const, size: 10 },
        formatter: (v: number) => v?.toFixed(1) ?? '',
      },
    },
  };

  return (
    <ChartCard
      titulo="Sectores en riesgo — predicción"
      subtitulo="Regresión lineal sobre 6 meses. Rojo = creciente, verde = decreciente, gris = estable."
      modos={['bar', 'table']}
      cargando={isLoading}
      vacio={rows.length === 0}
      height={400}
    >
      {{
        // @ts-ignore
        bar: <Bar data={chartData} options={options} plugins={[valueLabels]} />,
        table: <ChartTable columnas={COLUMNAS} filas={rows} />,
      }}
    </ChartCard>
  );
}
