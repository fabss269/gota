import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Prioridad } from '@/mocks/incidentsMock';
import { useFiltersStore } from '@/state/filtersStore';

const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  a_tiempo: 'A tiempo',
  alerta: 'Alerta',
  critica: 'Crítica',
};
const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  a_tiempo: Colors.statusATiempo,
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};

/**
 * Tab "Filtros" del Bottom Sheet (Spec 04, RF-04.1 a RF-04.6).
 *
 * Simplificación documentada: los selectores de Distrito/Sector, Tipo de atención,
 * Estado y Rango de fechas se muestran como en el diseño pero no están conectados
 * (no hay endpoint de catálogos real todavía, ver docs/API.md § 2). Categoría y
 * Prioridad sí filtran el mapa de verdad porque son datos que ya existen en el mock.
 */
export function FiltrosTab() {
  const categorias = useFiltersStore((s) => s.categorias);
  const toggleCategoria = useFiltersStore((s) => s.toggleCategoria);
  const prioridades = useFiltersStore((s) => s.prioridades);
  const togglePrioridad = useFiltersStore((s) => s.togglePrioridad);
  const reset = useFiltersStore((s) => s.reset);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Categoría</Text>
        <Pressable onPress={reset}>
          <Text style={styles.limpiar}>Limpiar</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        <Chip label="Agua" active={categorias.includes('agua')} onPress={() => toggleCategoria('agua')} />
        <Chip
          label="Desagüe"
          active={categorias.includes('desague')}
          onPress={() => toggleCategoria('desague')}
        />
      </View>

      <Text style={styles.sectionTitle}>Ubicación</Text>
      <View style={styles.disabledRow}>
        <Text style={styles.disabledLabel}>Chiclayo · Todos los distritos · Todos los sectores</Text>
      </View>

      <Text style={styles.sectionTitle}>Prioridad</Text>
      <View style={styles.chipRow}>
        {(Object.keys(PRIORIDAD_LABEL) as Prioridad[]).map((p) => (
          <Chip
            key={p}
            label={PRIORIDAD_LABEL[p]}
            active={prioridades.includes(p)}
            dotColor={PRIORIDAD_COLOR[p]}
            onPress={() => togglePrioridad(p)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Rango de fechas</Text>
      <View style={styles.disabledRow}>
        <Text style={styles.disabledLabel}>Hoy</Text>
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  dotColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  dotColor?: string;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark, marginTop: Spacing.sm },
  limpiar: { color: Colors.accent, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipLabel: { fontSize: 13, fontWeight: '600', color: Colors.textBody },
  chipLabelActive: { color: Colors.white },
  dot: { width: 8, height: 8, borderRadius: 4 },
  disabledRow: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
  },
  disabledLabel: { color: Colors.textMuted, fontSize: 13 },
});
