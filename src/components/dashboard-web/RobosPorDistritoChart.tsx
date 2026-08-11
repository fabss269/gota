import { StyleSheet, Text, View } from 'react-native';
import { Bar } from 'react-chartjs-2';

import { makeBarValueLabelsPlugin } from '@/components/dashboard-web/barValueLabelsPlugin';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRobosPorDistrito } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const valueLabels = makeBarValueLabelsPlugin((n) => n.toLocaleString('es-PE'));

/** Top 5 distritos con más robos de medidor — barra horizontal (etiquetas de
 * texto largo, pocas categorías, se compara magnitud exacta). */
export function RobosPorDistritoChart() {
  const { data, isLoading } = useRobosPorDistrito(5);
  const rows = data ?? [];

  const chartData = {
    labels: rows.map((r) => r.distrito),
    datasets: [
      {
        label: 'Robos de medidor',
        data: rows.map((r) => r.n_robos),
        backgroundColor: Colors.statusCritica,
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
    plugins: { legend: { display: false } },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Top 5 distritos — robos de medidor</Text>
      <Text style={styles.subtitulo}>Total histórico por distrito</Text>
      <View style={styles.chartWrap}>
        {isLoading ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>Sin datos</Text>
        ) : (
          // @ts-ignore
          <Bar data={chartData} options={options} plugins={[valueLabels]} />
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
    height: 380,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  chartWrap: { flex: 1 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
