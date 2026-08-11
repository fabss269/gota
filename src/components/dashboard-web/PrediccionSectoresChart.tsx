import { StyleSheet, Text, View } from 'react-native';
import { Bar } from 'react-chartjs-2';

import { makeBarValueLabelsPlugin } from '@/components/dashboard-web/barValueLabelsPlugin';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePrediccionSectores } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const valueLabels = makeBarValueLabelsPlugin((n) => n.toFixed(1));

const COLOR_TENDENCIA: Record<string, string> = {
  creciente: Colors.statusCritica,
  decreciente: Colors.statusATiempo,
  estable: Colors.textMuted,
};

const ETIQUETA_TENDENCIA: Record<string, string> = {
  creciente: '↑ Creciente',
  decreciente: '↓ Decreciente',
  estable: '→ Estable',
};

/** Predicción de sectores en riesgo (regresión lineal simple, 6 meses de
 * lookback) — barra horizontal ordenada por volumen previsto, coloreada por
 * tendencia para lectura ejecutiva rápida. */
export function PrediccionSectoresChart() {
  const { data, isLoading } = usePrediccionSectores(6);
  const rows = [...(data ?? [])]
    .sort((a, b) => b.pred_proximo_mes - a.pred_proximo_mes)
    .slice(0, 10);

  const chartData = {
    labels: rows.map((r) => r.sector.replace('CHICLAYO - ', '')),
    datasets: [
      {
        label: 'Predicción próximo mes',
        data: rows.map((r) => r.pred_proximo_mes),
        backgroundColor: rows.map((r) => COLOR_TENDENCIA[r.tendencia] ?? Colors.textMuted),
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
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const row = rows[ctx.dataIndex];
            return [
              ` Previsto: ${row.pred_proximo_mes.toFixed(1)}`,
              ` Tendencia: ${ETIQUETA_TENDENCIA[row.tendencia] ?? row.tendencia} (${row.cambio_pct_mensual.toFixed(1)}%/mes)`,
            ];
          },
        },
      },
    },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Sectores en riesgo — predicción</Text>
      <Text style={styles.subtitulo}>
        Regresión lineal sobre 6 meses. Rojo = creciente, verde = decreciente, gris = estable.
      </Text>
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
    height: 400,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  chartWrap: { flex: 1 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
