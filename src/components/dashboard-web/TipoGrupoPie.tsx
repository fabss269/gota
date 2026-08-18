import { Pie, Bar } from 'react-chartjs-2';

import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { Colors } from '@/constants/theme';
import { useTipoGrupoPie } from '@/hooks/useDashboardGeo';

import { barValueDatalabelsPreset, ensureChartRegistered, pieDatalabelsPreset } from './ChartSetup';

ensureChartRegistered();

const COLOR_POR_GRUPO: Record<string, string> = {
  agua: Colors.agua,
  desague: Colors.desague,
};

type Row = { etiqueta: string; n: number; pct: number };

const COLUMNAS: ChartTableColumn<Row>[] = [
  { header: 'Categoría', render: (r) => (r.etiqueta === 'agua' ? 'Agua' : 'Desagüe') },
  { header: 'Cantidad', align: 'right', width: 0.6, render: (r) => r.n.toLocaleString('es-PE') },
  { header: '%', align: 'right', width: 0.4, render: (r) => `${r.pct}%` },
];

/** Torta agua vs. desagüe — composición de 2 categorías, snapshot del período. */
export function TipoGrupoPie() {
  const { data, isLoading } = useTipoGrupoPie();
  const rows = data ?? [];

  const labels = rows.map((r) => (r.etiqueta === 'agua' ? 'Agua' : 'Desagüe'));
  const colores = rows.map((r) => COLOR_POR_GRUPO[r.etiqueta] ?? Colors.textMuted);

  const tooltipLabel = (ctx: any) => {
    const row = rows[ctx.dataIndex];
    return ` ${ctx.label}: ${row.n.toLocaleString('es-PE')} (${row.pct}%)`;
  };

  const pieData = {
    labels,
    datasets: [{ data: rows.map((r) => r.n), backgroundColor: colores, borderColor: Colors.surface, borderWidth: 2 }],
  };
  const pieOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: { callbacks: { label: tooltipLabel } },
      datalabels: pieDatalabelsPreset,
    },
  };

  // Bar: mono-color (regla del rediseño 2026-08-13 — barras de una sola
  // dimensión usan color único; los slots de color multicolor son solo del
  // pie). Uso primary porque este chart es global "servicio", no específico
  // de agua/desagüe.
  const barData = {
    labels,
    datasets: [{ label: 'Incidencias', data: rows.map((r) => r.n), backgroundColor: Colors.primary, borderRadius: 4 }],
  };
  const barOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, grid: { color: '#e5e7eb' } }, x: { grid: { display: false } } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: tooltipLabel } },
      datalabels: barValueDatalabelsPreset,
    },
  };

  return (
    <ChartCard
      titulo="Agua vs. desagüe"
      subtitulo="Composición de incidencias por tipo de servicio"
      modos={['pie', 'bar', 'table']}
      cargando={isLoading}
      vacio={rows.length === 0}
      height={320}
    >
      {{
        // @ts-ignore
        pie: <Pie data={pieData} options={pieOptions} />,
        // @ts-ignore
        bar: <Bar data={barData} options={barOptions} />,
        table: <ChartTable columnas={COLUMNAS} filas={rows} />,
      }}
    </ChartCard>
  );
}
