import { StyleSheet, Text, View } from 'react-native';
import { Bar, Pie } from 'react-chartjs-2';

import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { Colors, Spacing } from '@/constants/theme';
import { useTipoAtencionPie } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const PALETA = [
  '#0D2B52', '#0152AC', '#1565C0', '#8E24AA', '#D080E8', '#EAB308', '#8B9BB8',
];

type Row = { etiqueta: string; n: number; pct: number };

const COLUMNAS: ChartTableColumn<Row>[] = [
  { header: 'Tipo de atención', render: (r) => r.etiqueta },
  { header: 'Cantidad', align: 'right', width: 0.6, render: (r) => r.n.toLocaleString('es-PE') },
  { header: '%', align: 'right', width: 0.4, render: (r) => `${r.pct}%` },
];

/** Torta de tipo de atención (top 6 + Otros) — respeta el filtro global de
 * servicio (agua/desagüe/todos) definido en FilterBar. */
export function TipoAtencionPie() {
  const { data, isLoading } = useTipoAtencionPie();
  const rows = data ?? [];
  const colores = rows.map((_, i) => PALETA[i % PALETA.length]);

  const tooltipLabel = (ctx: any) => {
    const row = rows[ctx.dataIndex];
    return ` ${row.etiqueta}: ${row.n.toLocaleString('es-PE')} (${row.pct}%)`;
  };

  const pieData = {
    labels: rows.map((r) => r.etiqueta),
    datasets: [{ data: rows.map((r) => r.n), backgroundColor: colores, borderColor: Colors.surface, borderWidth: 2 }],
  };
  const pieOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipLabel } } },
  };

  const barData = {
    labels: rows.map((r) => r.etiqueta),
    datasets: [{ label: 'Incidencias', data: rows.map((r) => r.n), backgroundColor: colores, borderRadius: 4 }],
  };
  const barOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 36 } },
    scales: { x: { beginAtZero: true, grid: { color: '#e5e7eb' } }, y: { grid: { display: false } } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipLabel } } },
  };

  const pieConLeyenda = (
    <View style={styles.body}>
      <View style={{ flex: 1 }}>
        {/* @ts-ignore */}
        <Pie data={pieData} options={pieOptions} />
      </View>
      {rows.length > 0 && (
        <View style={styles.leyenda}>
          {rows.map((r, i) => (
            <View key={r.etiqueta} style={styles.leyendaFila}>
              <View style={[styles.dot, { backgroundColor: PALETA[i % PALETA.length] }]} />
              <Text style={styles.leyendaTexto} numberOfLines={1}>
                {r.etiqueta} — {r.pct}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ChartCard
      titulo="Tipo de atención"
      subtitulo="Top 6 motivos + Otros"
      modos={['pie', 'bar', 'table']}
      cargando={isLoading}
      vacio={rows.length === 0}
      height={320}
    >
      {{
        pie: pieConLeyenda,
        // @ts-ignore
        bar: <Bar data={barData} options={barOptions} />,
        table: <ChartTable columnas={COLUMNAS} filas={rows} />,
      }}
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  leyenda: { flex: 1, gap: 6, minWidth: 140 },
  leyendaFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  leyendaTexto: { fontSize: 11, color: Colors.textBody, flexShrink: 1 },
});
