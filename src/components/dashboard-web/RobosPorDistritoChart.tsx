import { Bar, Pie } from 'react-chartjs-2';

import { makeBarValueLabelsPlugin } from '@/components/dashboard-web/barValueLabelsPlugin';
import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { Colors } from '@/constants/theme';
import { useRobosPorDistrito } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const valueLabels = makeBarValueLabelsPlugin((n) => n.toLocaleString('es-PE'));

type Row = { distritoid: number | null; distrito: string; n_robos: number };

const COLUMNAS: ChartTableColumn<Row>[] = [
  { header: 'Distrito', render: (r) => r.distrito },
  { header: 'Robos de medidor', align: 'right', render: (r) => r.n_robos.toLocaleString('es-PE') },
];

/** Top 5 distritos con más robos de medidor — barra horizontal (etiquetas de
 * texto largo, pocas categorías, se compara magnitud exacta). */
export function RobosPorDistritoChart() {
  const { data, isLoading } = useRobosPorDistrito(5);
  const rows = data ?? [];

  const barData = {
    labels: rows.map((r) => r.distrito),
    datasets: [{ label: 'Robos de medidor', data: rows.map((r) => r.n_robos), backgroundColor: Colors.statusCritica, borderRadius: 4 }],
  };
  const barOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 36 } },
    scales: { x: { beginAtZero: true, grid: { color: '#e5e7eb' } }, y: { grid: { display: false } } },
    plugins: { legend: { display: false } },
  };

  const pieData = {
    labels: rows.map((r) => r.distrito),
    datasets: [{ data: rows.map((r) => r.n_robos), backgroundColor: Colors.statusCritica, borderColor: Colors.surface, borderWidth: 2 }],
  };
  const pieOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
  };

  return (
    <ChartCard
      titulo="Top 5 distritos — robos de medidor"
      subtitulo="Total histórico por distrito"
      modos={['bar', 'pie', 'table']}
      cargando={isLoading}
      vacio={rows.length === 0}
      height={380}
    >
      {{
        // @ts-ignore
        bar: <Bar data={barData} options={barOptions} plugins={[valueLabels]} />,
        // @ts-ignore
        pie: <Pie data={pieData} options={pieOptions} />,
        table: <ChartTable columnas={COLUMNAS} filas={rows} />,
      }}
    </ChartCard>
  );
}
