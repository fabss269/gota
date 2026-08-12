import { Bar, Line } from 'react-chartjs-2';

import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { useSerieMensual } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

type Props = { mostrarProyeccion?: boolean };

/** Línea mensual con overlay 2025 vs 2026 + proyección opcional (regresión
 * lineal). `mostrarProyeccion=false` la oculta — mismo componente para la vista
 * "Tendencias" (sin proyección) sin bifurcar en dos. */
export function MonthlyLineChart({ mostrarProyeccion = true }: Props) {
  const { data, isLoading } = useSerieMensual();

  const chartLabels = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];

  // Alinear cada punto a su índice de mes (0-11)
  const alinearAMes = (puntos: { x: string; y: number }[] = []) => {
    const out: (number | null)[] = new Array(12).fill(null);
    puntos.forEach((p) => {
      const mes = parseInt(p.x.slice(5), 10) - 1;
      if (mes >= 0 && mes < 12) out[mes] = p.y;
    });
    return out;
  };

  const y2026 = alinearAMes(data?.actual);
  const y2025 = alinearAMes(data?.anio_anterior);
  // Predicción: se pone junto a los meses futuros del 2026
  const yPred = alinearAMes(data?.prediccion);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: '2025',
        data: y2025,
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        pointRadius: 2,
        tension: 0.3,
      },
      {
        label: '2026',
        data: y2026,
        borderColor: '#0D2B52',
        backgroundColor: 'rgba(13, 43, 82, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#0D2B52',
        fill: true,
        tension: 0.3,
      },
      ...(mostrarProyeccion
        ? [
            {
              label: 'Proyección',
              data: yPred,
              borderColor: '#EF4444',
              backgroundColor: 'transparent',
              borderDash: [3, 3],
              pointRadius: 4,
              pointStyle: 'triangle',
              tension: 0,
            },
          ]
        : []),
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

  const barData = { labels: chartLabels, datasets: chartData.datasets.map((d) => ({ ...d, backgroundColor: d.borderColor, borderRadius: 3 })) };
  const barOptions: any = { ...options, interaction: undefined };

  type Row = { mes: string; y2025: number | null; y2026: number | null; yPred: number | null };
  const filas: Row[] = chartLabels.map((mes, i) => ({ mes, y2025: y2025[i], y2026: y2026[i], yPred: yPred[i] }));
  const columnas: ChartTableColumn<Row>[] = [
    { header: 'Mes', render: (r) => r.mes },
    { header: '2025', align: 'right', render: (r) => r.y2025 ?? '—' },
    { header: '2026', align: 'right', render: (r) => r.y2026 ?? '—' },
    ...(mostrarProyeccion ? [{ header: 'Proyección', align: 'right' as const, render: (r: Row) => r.yPred ?? '—' }] : []),
  ];

  return (
    <ChartCard
      titulo="Incidencias por mes"
      subtitulo={`Comparativo 2026 vs 2025.${mostrarProyeccion ? ' Línea roja = proyección próximos 2 meses (regresión lineal).' : ''}`}
      modos={['line', 'bar', 'table']}
      cargando={isLoading}
      height={320}
    >
      {{
        // @ts-ignore
        line: <Line data={chartData} options={options} />,
        // @ts-ignore
        bar: <Bar data={barData} options={barOptions} />,
        table: <ChartTable columnas={columnas} filas={filas} />,
      }}
    </ChartCard>
  );
}
