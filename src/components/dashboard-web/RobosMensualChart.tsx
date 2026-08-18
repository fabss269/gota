import { Bar, Line } from 'react-chartjs-2';

import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { useRobosMensual } from '@/hooks/useDashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Alinea puntos "YYYY-MM" a un array de 12 posiciones (Ene..Dic). */
function alinearAMes(puntos: { x: string; y: number }[] = []) {
  const out: (number | null)[] = new Array(12).fill(null);
  puntos.forEach((p) => {
    const m = parseInt(p.x.slice(5), 10) - 1;
    if (m >= 0 && m < 12) out[m] = p.y;
  });
  return out;
}

/** Robos por mes con overlay del año anterior — mismo patrón que MonthlyLineChart. */
export function RobosMensualChart() {
  const { data, isLoading } = useRobosMensual();
  const { anio } = useDashboardFilters();

  const yActual = alinearAMes(data?.actual);
  const yAnterior = alinearAMes(data?.anio_anterior);

  const chartData = {
    labels: LABELS,
    datasets: [
      {
        label: String(anio - 1),
        data: yAnterior,
        borderColor: '#F87171',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        pointRadius: 2,
        pointBackgroundColor: '#F87171',
        tension: 0.3,
      },
      {
        label: String(anio),
        data: yActual,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#EF4444',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      x: { grid: { display: false } },
    },
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: { padding: 10 },
    },
  };

  const barData = { labels: LABELS, datasets: chartData.datasets.map((d) => ({ ...d, backgroundColor: d.borderColor, borderRadius: 3 })) };

  type Row = { mes: string; anterior: number | null; actual: number | null };
  const filas: Row[] = LABELS.map((mes, i) => ({ mes, anterior: yAnterior[i], actual: yActual[i] }));
  const columnas: ChartTableColumn<Row>[] = [
    { header: 'Mes', render: (r) => r.mes },
    { header: String(anio - 1), align: 'right', render: (r) => r.anterior ?? '—' },
    { header: String(anio), align: 'right', render: (r) => r.actual ?? '—' },
  ];

  return (
    <ChartCard
      titulo="Robos de medidor por mes"
      subtitulo={`Comparativo ${anio} vs ${anio - 1}`}
      modos={['line', 'bar', 'table']}
      cargando={isLoading}
      height={320}
    >
      {{
        // @ts-ignore
        line: <Line data={chartData} options={options} />,
        // @ts-ignore
        bar: <Bar data={barData} options={options} />,
        table: <ChartTable columnas={columnas} filas={filas} />,
      }}
    </ChartCard>
  );
}
