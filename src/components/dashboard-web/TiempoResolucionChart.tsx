import { Bar, Line } from 'react-chartjs-2';

import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { useTiempoResolucionMensual } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

type Row = { x: string; y: number };

const COLUMNAS: ChartTableColumn<Row>[] = [
  { header: 'Mes', render: (r) => r.x },
  { header: 'Días promedio', align: 'right', render: (r) => r.y.toFixed(1) },
];

export function TiempoResolucionChart() {
  const { data, isLoading } = useTiempoResolucionMensual();
  const puntos = data?.puntos ?? [];

  const chartData = {
    labels: puntos.map((p) => p.x),
    datasets: [
      {
        label: 'Días promedio',
        data: puntos.map((p) => p.y),
        borderColor: '#166534',
        backgroundColor: 'rgba(22, 101, 52, 0.1)',
        fill: true,
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
      },
    ],
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      x: { grid: { display: false } },
    },
    plugins: { legend: { display: false } },
  };

  const barData = {
    labels: puntos.map((p) => p.x),
    datasets: [{ label: 'Días promedio', data: puntos.map((p) => p.y), backgroundColor: '#166534', borderRadius: 3 }],
  };

  return (
    <ChartCard
      titulo="Tiempo promedio de resolución"
      subtitulo="Días entre creación y solución, por mes"
      modos={['line', 'bar', 'table']}
      cargando={isLoading}
      height={320}
    >
      {{
        // @ts-ignore
        line: <Line data={chartData} options={options} />,
        // @ts-ignore
        bar: <Bar data={barData} options={options} />,
        table: <ChartTable columnas={COLUMNAS} filas={puntos} />,
      }}
    </ChartCard>
  );
}
