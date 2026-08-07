import { StyleSheet, Text, View } from 'react-native';
import { Bar } from 'react-chartjs-2';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTopSectores } from '@/hooks/useDashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

export function TopSectoresBar() {
  const { data, isLoading } = useTopSectores(10);
  const seleccionarSector = useDashboardFilters((s) => s.seleccionarSector);

  const rows = data ?? [];
  const chartData = {
    labels: rows.map((r) => r.sector.replace('CHICLAYO - ', '')),
    datasets: [
      {
        label: 'Agua',
        data: rows.map((r) => r.n_agua),
        backgroundColor: '#0D2B52',
        stack: 'a',
      },
      {
        label: 'Desagüe',
        data: rows.map((r) => r.n_desague),
        backgroundColor: '#166534',
        stack: 'a',
      },
    ],
  };

  const options: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_: any, elements: any[]) => {
      if (!elements?.length) return;
      const idx = elements[0].index;
      const row = rows[idx];
      if (row?.sectorid) seleccionarSector(row.sectorid, row.sector);
    },
    scales: {
      x: { stacked: true, grid: { color: '#e5e7eb' } },
      y: { stacked: true, grid: { display: false } },
    },
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: {
        callbacks: {
          footer: (items: any) => {
            const total = items.reduce((s: number, i: any) => s + (i.parsed?.x || 0), 0);
            return `Total: ${total}`;
          },
        },
      },
    },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Top 10 sectores</Text>
      <Text style={styles.subtitulo}>Click en una barra para filtrar el dashboard por ese sector</Text>
      <View style={styles.chartWrap}>
        {isLoading ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>Sin datos</Text>
        ) : (
          // @ts-ignore - Bar props typing en react-chartjs-2 con any-options
          <Bar data={chartData} options={options} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    minHeight: 380,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  chartWrap: { flex: 1, minHeight: 300 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
