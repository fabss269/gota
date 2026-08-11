import { StyleSheet, Text, View } from 'react-native';
import { Pie } from 'react-chartjs-2';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTipoAtencionPie } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

const PALETA = [
  '#0D2B52', '#0152AC', '#1565C0', '#8E24AA', '#D080E8', '#EAB308', '#8B9BB8',
];

/** Torta de tipo de atención (top 6 + Otros) — respeta el filtro global de
 * servicio (agua/desagüe/todos) definido en FilterBar. */
export function TipoAtencionPie() {
  const { data, isLoading } = useTipoAtencionPie();
  const rows = data ?? [];

  const chartData = {
    labels: rows.map((r) => r.etiqueta),
    datasets: [
      {
        data: rows.map((r) => r.n),
        backgroundColor: rows.map((_, i) => PALETA[i % PALETA.length]),
        borderColor: Colors.surface,
        borderWidth: 2,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const row = rows[ctx.dataIndex];
            return ` ${row.etiqueta}: ${row.n.toLocaleString('es-PE')} (${row.pct}%)`;
          },
        },
      },
    },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Tipo de atención</Text>
      <Text style={styles.subtitulo}>Top 6 motivos + Otros</Text>
      <View style={styles.body}>
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
  body: { flex: 1, flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  chartWrap: { flex: 1 },
  leyenda: { flex: 1, gap: 6, minWidth: 140 },
  leyendaFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  leyendaTexto: { fontSize: 11, color: Colors.textBody, flexShrink: 1 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
