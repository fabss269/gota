import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { Sparkline } from './Sparkline';

type Props = {
  titulo: string;
  valor: string | number;
  unidad?: string;
  deltaAbs: number | null;
  // "buenoSiBaja" invierte la semántica: para "tiempo de resolución", bajar es bueno.
  buenoSiBaja?: boolean;
  sparkline?: { x: string; y: number }[];
  color?: string;
  icono?: React.ComponentProps<typeof Ionicons>['name'];
  cargando?: boolean;
};

function formatValor(v: string | number): string {
  if (typeof v === 'number') {
    if (!isFinite(v)) return '—';
    if (v >= 1000) return v.toLocaleString('es-PE');
    return v.toString();
  }
  return v;
}

export function KpiCard({
  titulo, valor, unidad, deltaAbs,
  buenoSiBaja = false, sparkline = [], color = Colors.accent,
  icono, cargando = false,
}: Props) {
  const positivo = deltaAbs != null ? (buenoSiBaja ? deltaAbs < 0 : deltaAbs > 0) : null;
  const deltaColor = positivo == null
    ? Colors.textMuted
    : (positivo ? Colors.statusATiempo : Colors.statusCritica);

  // Formato del delta: entero con separador de miles si es >= 100 o si no tiene
  // decimales; con 1 decimal si es un valor pequeño (típicamente "tiempo mediano").
  const fmtDelta = (n: number): string => {
    const abs = Math.abs(n);
    if (abs >= 10 || Number.isInteger(n)) return Math.round(abs).toLocaleString('es-PE');
    return abs.toFixed(1);
  };

  return (
    <View style={styles.card}>
      <View style={styles.tituloRow}>
        {icono && <Ionicons name={icono} size={14} color={Colors.textMuted} />}
        <Text style={styles.titulo}>{titulo}</Text>
      </View>

      <View style={styles.valorRow}>
        <Text style={styles.valor}>{cargando ? '…' : formatValor(valor)}</Text>
        {unidad && <Text style={styles.unidad}>{unidad}</Text>}
      </View>

      {deltaAbs != null && !cargando && (
        <View style={styles.deltaRow}>
          <Text style={[styles.delta, { color: deltaColor }]}>
            {deltaAbs > 0 ? '+' : deltaAbs < 0 ? '−' : ''}{fmtDelta(deltaAbs)}
            {unidad ? ` ${unidad}` : ''} vs. período anterior
          </Text>
        </View>
      )}
      {deltaAbs == null && !cargando && (
        <Text style={styles.deltaMuted}>Sin comparativo</Text>
      )}

      {sparkline.length > 1 && <Sparkline data={sparkline} color={color} />}
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
    minWidth: 200,
    flex: 1,
  },
  tituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titulo: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  valorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
    gap: 6,
  },
  valor: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.textBody,
    lineHeight: 34,
  },
  unidad: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  delta: {
    fontSize: 12,
    fontWeight: '500',
  },
  deltaMuted: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
