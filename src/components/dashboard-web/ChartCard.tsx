import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type ModoChart = 'bar' | 'pie' | 'line' | 'table';

const ICONO_MODO: Record<ModoChart, keyof typeof Ionicons.glyphMap> = {
  bar: 'bar-chart-outline',
  pie: 'pie-chart-outline',
  line: 'analytics-outline',
  table: 'list-outline',
};

const ETIQUETA_MODO: Record<ModoChart, string> = {
  bar: 'barras',
  pie: 'torta',
  line: 'línea',
  table: 'tabla',
};

type Props = {
  titulo: string;
  subtitulo?: string;
  modos: ModoChart[];
  cargando?: boolean;
  vacio?: boolean;
  vacioMensaje?: string;
  height?: number;
  extraHeader?: ReactNode;
  /** Fila opcional entre el header y el gráfico (ej. filtros de
   * LongitudPorMaterialChart) — se mantiene visible en todos los modos. */
  filtros?: ReactNode;
  children: Partial<Record<ModoChart, ReactNode>>;
};

/**
 * Wrapper delgado alrededor de los charts de `dashboard-web/` — agrega un
 * selector de modo (torta/barras/línea/tabla) en el header (pedido de Edgar
 * 2026-08-12: poder intercalar tipo de gráfico sin perder la info), mismo
 * look que ya tenía el `card` de cada chart. Cada chart sigue armando su
 * propia config de Chart.js por modo (`children[modo]`) en vez de normalizar
 * las opciones de barra/torta/línea en un motor 100% genérico — con 5-8
 * componentes, un poco de duplicación por componente es más seguro.
 */
export function ChartCard({
  titulo,
  subtitulo,
  modos,
  cargando = false,
  vacio = false,
  vacioMensaje = 'Sin datos',
  height = 320,
  extraHeader,
  filtros,
  children,
}: Props) {
  const [modo, setModo] = useState<ModoChart>(modos[0]);
  const modoActivo = modos.includes(modo) ? modo : modos[0];

  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.titulo}>{titulo}</Text>
          {subtitulo && <Text style={styles.subtitulo}>{subtitulo}</Text>}
        </View>
        {extraHeader}
        {modos.length > 1 && (
          <View style={styles.switcher}>
            {modos.map((m) => (
              <Pressable
                key={m}
                onPress={() => setModo(m)}
                style={[styles.switchBtn, modoActivo === m && styles.switchBtnActivo]}
                accessibilityLabel={`Ver como ${ETIQUETA_MODO[m]}`}
              >
                <Ionicons name={ICONO_MODO[m]} size={13} color={modoActivo === m ? Colors.white : Colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {filtros}
      <View style={styles.chartWrap}>
        {cargando ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : vacio ? (
          <Text style={styles.muted}>{vacioMensaje}</Text>
        ) : (
          (children[modoActivo] ?? null)
        )}
      </View>
    </View>
  );
}

export type ChartTableColumn<T> = {
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
};

/** Modo tabla genérico para usar dentro de `ChartCard` — mismas columnas/filas
 * que `DataTable.tsx`, pero sin su propio `card`/título (ya los pone ChartCard). */
export function ChartTable<T>({ columnas, filas }: { columnas: ChartTableColumn<T>[]; filas: T[] }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={tableStyles.headRow}>
        {columnas.map((c, i) => (
          <Text key={i} style={[tableStyles.headCell, { flex: c.width ?? 1, textAlign: c.align ?? 'left' }]}>
            {c.header}
          </Text>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }}>
        {filas.length === 0 ? (
          <Text style={tableStyles.muted}>Sin datos</Text>
        ) : (
          filas.map((row, r) => (
            <View key={r} style={tableStyles.row}>
              {columnas.map((c, i) => (
                <View
                  key={i}
                  style={{
                    flex: c.width ?? 1,
                    alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start',
                  }}
                >
                  <Text style={tableStyles.cell} numberOfLines={2}>
                    {c.render(row)}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
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
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: 8 },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  switcher: { flexDirection: 'row', backgroundColor: Colors.border, borderRadius: 999, padding: 2, gap: 2, flexShrink: 0 },
  switchBtn: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  switchBtnActivo: { backgroundColor: Colors.accent },
  chartWrap: { flex: 1 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});

const tableStyles = StyleSheet.create({
  headRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: Colors.border },
  headCell: { fontSize: 10.5, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700', paddingRight: 6 },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  cell: { fontSize: 12, color: Colors.textBody, paddingRight: 6 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
});
