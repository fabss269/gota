import { Bar, Pie } from 'react-chartjs-2';

import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { Colors } from '@/constants/theme';
import { useRobosPorDistrito } from '@/hooks/useDashboardGeo';

import { barValueDatalabelsPreset, ensureChartRegistered, pieDatalabelsPreset } from './ChartSetup';

ensureChartRegistered();

// Paleta discreta para el modo torta — antes daban todas del mismo rojo
// crítico y no se distinguía qué slice era qué distrito. Se mantienen tonos
// cálidos (rojos/anaranjados) para no perder la lectura "esto es robo".
const PALETA_ROBOS = ['#B91C1C', '#DC2626', '#EF4444', '#F97316', '#FB923C', '#FDBA74', '#FED7AA'];

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
    // Mono-color: barras single-var. Rojo crítico para leer "robos".
    datasets: [{ label: 'Robos de medidor', data: rows.map((r) => r.n_robos), backgroundColor: Colors.statusCritica, borderRadius: 4 }],
  };
  const barOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 36 } },
    scales: { x: { beginAtZero: true, grid: { color: '#e5e7eb' } }, y: { grid: { display: false } } },
    plugins: {
      legend: { display: false },
      datalabels: { ...barValueDatalabelsPreset, align: 'right' as const, color: '#7F1D1D' },
    },
  };

  const pieData = {
    labels: rows.map((r) => r.distrito),
    datasets: [
      {
        data: rows.map((r) => r.n_robos),
        backgroundColor: rows.map((_, i) => PALETA_ROBOS[i % PALETA_ROBOS.length]),
        borderColor: Colors.surface,
        borderWidth: 2,
      },
    ],
  };
  const pieOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
      datalabels: pieDatalabelsPreset,
    },
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
        bar: <Bar data={barData} options={barOptions} />,
        // @ts-ignore
        pie: <Pie data={pieData} options={pieOptions} />,
        table: <ChartTable columnas={COLUMNAS} filas={rows} />,
      }}
    </ChartCard>
  );
}
