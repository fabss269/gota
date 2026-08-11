import { StyleSheet, Text, View } from 'react-native';
import { Line } from 'react-chartjs-2';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTiempoResolucionMensual } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

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

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Tiempo promedio de resolución</Text>
      <Text style={styles.subtitulo}>Días entre creación y solución, por mes</Text>
      <View style={styles.chartWrap}>
        {isLoading ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : (
          // @ts-ignore
          <Line data={chartData} options={options} />
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
    height: 320,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  chartWrap: { flex: 1 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
