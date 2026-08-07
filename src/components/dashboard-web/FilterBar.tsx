import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  ANIOS_DISPONIBLES,
  useDashboardFilters,
} from '@/state/dashboardFilters';

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Barra de filtros globales: período + año/mes + servicio + chip de sector. */
export function FilterBar() {
  const {
    periodo, grupo, anio, mes, sectorNombre,
    setPeriodo, setGrupo, setAnio, setMes, limpiarSector,
  } = useDashboardFilters();

  return (
    <View style={styles.row}>
      {/* Período */}
      <View style={styles.grupo}>
        <Text style={styles.label}>Período</Text>
        <View style={styles.pillGroup}>
          {(['anual', 'mensual'] as const).map((p) => (
            <Pressable
              key={p}
              style={[styles.pill, periodo === p && styles.pillActivo]}
              onPress={() => setPeriodo(p)}
            >
              <Text style={[styles.pillText, periodo === p && styles.pillTextActivo]}>
                {p === 'anual' ? 'Anual' : 'Mensual'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Año */}
      <View style={styles.grupo}>
        <Text style={styles.label}>Año</Text>
        <View style={styles.pillGroup}>
          {ANIOS_DISPONIBLES.map((a) => (
            <Pressable
              key={a}
              style={[styles.pill, anio === a && styles.pillActivo]}
              onPress={() => setAnio(a)}
            >
              <Text style={[styles.pillText, anio === a && styles.pillTextActivo]}>
                {a}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Mes — solo visible cuando periodo=mensual */}
      {periodo === 'mensual' && (
        <View style={styles.grupo}>
          <Text style={styles.label}>Mes</Text>
          <View style={styles.pillGroup}>
            {MESES.map((nombre, i) => {
              const m = i + 1;
              return (
                <Pressable
                  key={m}
                  style={[styles.pillMes, mes === m && styles.pillActivo]}
                  onPress={() => setMes(m)}
                >
                  <Text style={[styles.pillText, mes === m && styles.pillTextActivo]}>
                    {nombre}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Servicio */}
      <View style={styles.grupo}>
        <Text style={styles.label}>Servicio</Text>
        <View style={styles.pillGroup}>
          {(['todos', 'agua', 'desague'] as const).map((g) => (
            <Pressable
              key={g}
              style={[styles.pill, grupo === g && styles.pillActivo]}
              onPress={() => setGrupo(g)}
            >
              <Text style={[styles.pillText, grupo === g && styles.pillTextActivo]}>
                {g === 'todos' ? 'Todos' : g === 'agua' ? 'Agua' : 'Desagüe'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Chip de sector activo */}
      {sectorNombre && (
        <View style={styles.chip}>
          <Ionicons name="layers-outline" size={14} color={Colors.accent} />
          <Text style={styles.chipText}>{sectorNombre}</Text>
          <Pressable onPress={limpiarSector} hitSlop={4}>
            <Ionicons name="close" size={14} color={Colors.accent} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    flexWrap: 'wrap',
  },
  grupo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  pillGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    padding: 2,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  pillMes: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  pillActivo: { backgroundColor: Colors.accent },
  pillText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  pillTextActivo: { color: Colors.white },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentBg,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  chipText: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
});
