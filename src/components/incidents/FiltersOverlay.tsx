import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
import { TODOS_SECTOR, useIncidentsListFiltersStore } from '@/state/incidentsListFiltersStore';

const PRIORIDAD_OPTIONS: { value: Prioridad; label: string; dotColor: string }[] = [
  { value: 'a_tiempo', label: 'A tiempo', dotColor: Colors.statusATiempo },
  { value: 'alerta', label: 'Alerta', dotColor: Colors.statusAlerta },
  { value: 'critica', label: 'Crítica', dotColor: Colors.statusCritica },
];

const ESTADO_OPTIONS: { value: EstadoIncidencia; label: string }[] = [
  { value: 'CREADO', label: 'Registrado' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'ATENDIDO', label: 'Atendido' },
];

const SECTOR_OPTIONS = ['Sector 5', 'Sector 3', 'Sector 1'];

type Props = { visible: boolean; onClose: () => void };

/**
 * Overlay - Filtros Incidencias (Spec 05, RF-05.3): panel completo con las 5 secciones
 * del diseño. "Mi cuadrilla" queda deshabilitada — el usuario autenticado (mock, ver
 * `src/auth/session.ts`) no trae un campo de cuadrilla propia todavía, y no hay
 * endpoint real (`docs/API.md` § 6) para resolverlo sin inventar el dato.
 */
export function FiltersOverlay({ visible, onClose }: Props) {
  const prioridades = useIncidentsListFiltersStore((s) => s.prioridades);
  const togglePrioridad = useIncidentsListFiltersStore((s) => s.togglePrioridad);
  const estados = useIncidentsListFiltersStore((s) => s.estados);
  const toggleEstado = useIncidentsListFiltersStore((s) => s.toggleEstado);
  const categorias = useIncidentsListFiltersStore((s) => s.categorias);
  const toggleCategoria = useIncidentsListFiltersStore((s) => s.toggleCategoria);
  const asignado = useIncidentsListFiltersStore((s) => s.asignado);
  const setAsignado = useIncidentsListFiltersStore((s) => s.setAsignado);
  const sectorId = useIncidentsListFiltersStore((s) => s.sectorId);
  const setSector = useIncidentsListFiltersStore((s) => s.setSector);
  const reset = useIncidentsListFiltersStore((s) => s.reset);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Filtros</Text>
            <Pressable onPress={reset}>
              <Text style={styles.limpiar}>Limpiar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>PRIORIDAD</Text>
            <View style={styles.chipRow}>
              {PRIORIDAD_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  dotColor={opt.dotColor}
                  active={prioridades.includes(opt.value)}
                  onPress={() => togglePrioridad(opt.value)}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>ESTADO</Text>
            <View style={styles.chipRow}>
              {ESTADO_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={estados.includes(opt.value)}
                  onPress={() => toggleEstado(opt.value)}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>RED ASOCIADA</Text>
            <View style={styles.chipRow}>
              <Chip label="Agua" active={categorias.includes('agua')} onPress={() => toggleCategoria('agua')} />
              <Chip
                label="Desagüe"
                active={categorias.includes('desague')}
                onPress={() => toggleCategoria('desague')}
              />
            </View>

            <Text style={styles.sectionTitle}>ASIGNADO</Text>
            <View style={styles.chipRow}>
              <Chip label="Todos" active={asignado === 'todos'} onPress={() => setAsignado('todos')} />
              <Chip label="Mi cuadrilla" active={false} disabled onPress={() => {}} />
              <Chip
                label="Sin asignar"
                active={asignado === 'sin_asignar'}
                onPress={() => setAsignado('sin_asignar')}
              />
            </View>

            <Text style={styles.sectionTitle}>SECTOR</Text>
            <View style={styles.chipRow}>
              <Chip label="Todos" active={sectorId === TODOS_SECTOR} onPress={() => setSector(TODOS_SECTOR)} />
              {SECTOR_OPTIONS.map((s) => (
                <Chip key={s} label={s} active={sectorId === s} onPress={() => setSector(s)} />
              ))}
            </View>
          </ScrollView>

          <Pressable style={styles.applyButton} onPress={onClose}>
            <Text style={styles.applyButtonLabel}>Aplicar filtros</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({
  label,
  active,
  onPress,
  dotColor,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  dotColor?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive, disabled && styles.chipLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 43, 82, 0.25)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: '80%',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  limpiar: { color: Colors.accent, fontWeight: '600' },
  scrollContent: { paddingBottom: Spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
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
  chipDisabled: { opacity: 0.4 },
  chipLabel: { fontSize: 13, fontWeight: '600', color: Colors.textBody },
  chipLabelActive: { color: Colors.white },
  chipLabelDisabled: { color: Colors.textMuted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  applyButtonLabel: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
