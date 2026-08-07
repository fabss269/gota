import { StyleSheet, Text, View } from 'react-native';
import { Line } from 'react-chartjs-2';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSerieMensual } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

/** Línea mensual con overlay 2025 vs 2026 + proyección (regresión lineal). */
export function MonthlyLineChart() {
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
      <Text style={styles.titulo}>Incidencias por mes</Text>
      <Text style={styles.subtitulo}>
        Comparativo 2026 vs 2025. Línea roja = proyección próximos 2 meses (regresión lineal).
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
