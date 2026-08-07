import { StyleSheet, Text, View } from 'react-native';
import { Bar } from 'react-chartjs-2';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTipoAtencionMensual } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

// Paleta consistente y accesible — pensada para diferenciar tipos sin depender
// de asociaciones semánticas específicas.
const COLORES = [
  '#0D2B52', '#78350F', '#0891B2', '#EA580C', '#7C3AED',
  '#0F766E', '#DB2777', '#94a3b8',
];

export function TipoAtencionStacked() {
  const { data, isLoading } = useTipoAtencionMensual();
  const tipos = data?.tipos ?? [];
  const puntos = data?.puntos ?? [];

  const chartData = {
    labels: puntos.map((p) => p.x),
    datasets: tipos.map((tipo, i) => ({
      label: tipo.length > 30 ? tipo.slice(0, 27) + '…' : tipo,
      data: puntos.map((p) => p.valores[tipo] ?? 0),
      backgroundColor: COLORES[i % COLORES.length],
      stack: 'main',
    })),
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, grid: { color: '#e5e7eb' } },
    },
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 10 } },
    },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Mezcla mensual por tipo de atención</Text>
      <Text style={styles.subtitulo}>Área apilada — top 6 tipos + &quot;Otros&quot;</Text>
      <View style={styles.chartWrap}>
        {isLoading ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : (
          // @ts-ignore
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
    minHeight: 340,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  chartWrap: { flex: 1, minHeight: 260 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
