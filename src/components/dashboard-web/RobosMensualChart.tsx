import { StyleSheet, Text, View } from 'react-native';
import { Line } from 'react-chartjs-2';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRobosMensual } from '@/hooks/useDashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Alinea puntos "YYYY-MM" a un array de 12 posiciones (Ene..Dic). */
function alinearAMes(puntos: { x: string; y: number }[] = []) {
  const out: (number | null)[] = new Array(12).fill(null);
  puntos.forEach((p) => {
    const m = parseInt(p.x.slice(5), 10) - 1;
    if (m >= 0 && m < 12) out[m] = p.y;
  });
  return out;
}

/** Robos por mes con overlay del año anterior — mismo patrón que MonthlyLineChart. */
export function RobosMensualChart() {
  const { data, isLoading } = useRobosMensual();
  const { anio } = useDashboardFilters();

  const yActual = alinearAMes(data?.actual);
  const yAnterior = alinearAMes(data?.anio_anterior);

  const chartData = {
    labels: LABELS,
    datasets: [
      {
        label: String(anio - 1),
        data: yAnterior,
        borderColor: '#F87171',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        pointRadius: 2,
        pointBackgroundColor: '#F87171',
        tension: 0.3,
      },
      {
        label: String(anio),
        data: yActual,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#EF4444',
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

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Robos de medidor por mes</Text>
      <Text style={styles.subtitulo}>
        Comparativo {anio} vs {anio - 1}
      </Text>
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
    minHeight: 320,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  chartWrap: { flex: 1, minHeight: 240 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
