import { Bar, Line } from 'react-chartjs-2';

import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { useTiempoResolucionMensual } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const CHART_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Alinea la serie plana `[{x: 'YYYY-MM', y: number}]` que devuelve el backend
 * a un array indexado por mes (0..11), separado por año. Antes el chart
 * mostraba TODOS los meses del histórico en el eje X (ilegible con 12+ meses),
 * ahora solo Ene..Dic y overlaps para años consecutivos — mismo shape que
 * MonthlyLineChart. */
function alinearPorAnio(
  puntos: { x: string; y: number }[] = [],
  anio: number
): (number | null)[] {
  const out: (number | null)[] = new Array(12).fill(null);
  for (const p of puntos) {
    const [yStr, mStr] = p.x.split('-');
    if (Number(yStr) !== anio) continue;
    const mes = Number(mStr) - 1;
    if (mes >= 0 && mes < 12) out[mes] = p.y;
  }
  return out;
}

export function TiempoResolucionChart() {
  const { data, isLoading } = useTiempoResolucionMensual();
  const puntos = data?.puntos ?? [];

  const anioActual = new Date().getFullYear();
  const anioAnterior = anioActual - 1;
  const yActual = alinearPorAnio(puntos, anioActual);
  const yAnterior = alinearPorAnio(puntos, anioAnterior);

  const chartData = {
    labels: CHART_LABELS,
    datasets: [
      {
        label: String(anioAnterior),
        data: yAnterior,
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        pointRadius: 2,
        tension: 0.3,
      },
      {
        label: String(anioActual),
        data: yActual,
        borderColor: '#166534',
        backgroundColor: 'rgba(22, 101, 52, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#166534',
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

  const barData = {
    labels: CHART_LABELS,
    datasets: chartData.datasets.map((d) => ({
      ...d,
      backgroundColor: d.borderColor,
      borderRadius: 3,
    })),
  };
  const barOptions: any = { ...options, interaction: undefined };

  type Row = { mes: string; anterior: number | null; actual: number | null };
  const filas: Row[] = CHART_LABELS.map((mes, i) => ({
    mes,
    anterior: yAnterior[i],
    actual: yActual[i],
  }));
  const COLUMNAS: ChartTableColumn<Row>[] = [
    { header: 'Mes', render: (r) => r.mes },
    {
      header: String(anioAnterior),
      align: 'right',
      render: (r) => (r.anterior == null ? '—' : r.anterior.toFixed(1)),
    },
    {
      header: String(anioActual),
      align: 'right',
      render: (r) => (r.actual == null ? '—' : r.actual.toFixed(1)),
    },
  ];

  return (
    <ChartCard
      titulo="Tiempo promedio de resolución"
      subtitulo={`Días entre creación y solución, por mes · comparativo ${anioActual} vs ${anioAnterior}`}
      modos={['line', 'bar', 'table']}
      cargando={isLoading}
      height={320}
    >
      {{
        // @ts-ignore
        line: <Line data={chartData} options={options} />,
        // @ts-ignore
        bar: <Bar data={barData} options={barOptions} />,
        table: <ChartTable columnas={COLUMNAS} filas={filas} />,
      }}
    </ChartCard>
  );
}
