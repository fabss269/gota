import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type Columna<T> = {
  header: string;
  width?: number;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
};

type Props<T> = {
  titulo: string;
  subtitulo?: string;
  columnas: Columna<T>[];
  filas: T[];
  cargando?: boolean;
  extraHeader?: React.ReactNode;
  minHeight?: number;
};

export function DataTable<T>({
  titulo, subtitulo, columnas, filas,
  cargando = false, extraHeader, minHeight = 320,
}: Props<T>) {
  return (
    <View style={[styles.card, { minHeight }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>{titulo}</Text>
          {subtitulo && <Text style={styles.subtitulo}>{subtitulo}</Text>}
        </View>
        {extraHeader}
      </View>

      {/* Encabezado de columnas */}
      <View style={styles.headRow}>
        {columnas.map((c, i) => (
          <Text
            key={i}
            style={[
              styles.headCell,
              { flex: c.width ?? 1, textAlign: c.align ?? 'left' },
            ]}
          >
            {c.header}
          </Text>
        ))}
      </View>

      <ScrollView style={styles.body}>
        {cargando && <Text style={styles.muted}>Cargando…</Text>}
        {!cargando && filas.length === 0 && (
          <Text style={styles.muted}>Sin datos</Text>
        )}
        {filas.map((row, r) => (
          <View key={r} style={styles.row}>
            {columnas.map((c, i) => (
              <View
                key={i}
                style={{
                  flex: c.width ?? 1,
                  alignItems: c.align === 'right' ? 'flex-end'
                            : c.align === 'center' ? 'center' : 'flex-start',
                }}
              >
                {typeof c.render(row) === 'string' || typeof c.render(row) === 'number' ? (
                  <Text style={styles.cell} numberOfLines={2}>{c.render(row) as any}</Text>
                ) : (
                  c.render(row)
                )}
              </View>
            ))}
          </View>
        ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  headRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
  },
  headCell: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
    paddingRight: 6,
  },
  body: { flex: 1 },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  cell: {
    fontSize: 12,
    color: Colors.textBody,
    paddingRight: 6,
  },
  muted: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
