import { StyleSheet, Text, View } from 'react-native';
import { Pie } from 'react-chartjs-2';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTipoGrupoPie } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const COLOR_POR_GRUPO: Record<string, string> = {
  agua: Colors.agua,
  desague: Colors.desague,
};

/** Torta agua vs. desagüe — composición de 2 categorías, snapshot del período. */
export function TipoGrupoPie() {
  const { data, isLoading } = useTipoGrupoPie();
  const rows = data ?? [];

  const chartData = {
    labels: rows.map((r) => (r.etiqueta === 'agua' ? 'Agua' : 'Desagüe')),
    datasets: [
      {
        data: rows.map((r) => r.n),
        backgroundColor: rows.map((r) => COLOR_POR_GRUPO[r.etiqueta] ?? Colors.textMuted),
        borderColor: Colors.surface,
        borderWidth: 2,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const row = rows[ctx.dataIndex];
            return ` ${ctx.label}: ${row.n.toLocaleString('es-PE')} (${row.pct}%)`;
          },
        },
      },
    },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Agua vs. desagüe</Text>
      <Text style={styles.subtitulo}>Composición de incidencias por tipo de servicio</Text>
      <View style={styles.chartWrap}>
        {isLoading ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>Sin datos</Text>
        ) : (
          // @ts-ignore
          <Pie data={chartData} options={options} />
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
  chartWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
