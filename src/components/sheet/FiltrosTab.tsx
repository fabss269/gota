import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
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

// Mismos valores/labels que ya usa el resto de la app para "tipo"/"estado"
// (ver src/components/incidents/FiltersOverlay.tsx) — no existe un catálogo real
// todavía (docs/API.md § 2), así que se hardcodea igual que allá.
const TIPO_ATENCION_OPTIONS = ['Atoro en colector', 'Fuga en vereda', 'Fuga de agua', 'Falta de agua'];
const ESTADO_OPTIONS: { value: EstadoIncidencia; label: string }[] = [
  { value: 'CREADO', label: 'Creado' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'ATENDIDO', label: 'Atendido' },
];

/**
 * Tab "Filtros" del Bottom Sheet (Spec 04, RF-04.1 a RF-04.6).
 *
 * Simplificación documentada: los selectores de Distrito/Sector y Rango de fechas se
 * muestran como en el diseño pero no están conectados (no hay endpoint de catálogos
 * real todavía, ver docs/API.md § 2). Categoría, Prioridad, Tipo de atención y Estado
 * sí filtran el mapa de verdad porque son datos que ya existen en el mock.
 */
export function FiltrosTab() {
  const categorias = useFiltersStore((s) => s.categorias);
  const toggleCategoria = useFiltersStore((s) => s.toggleCategoria);
  const prioridades = useFiltersStore((s) => s.prioridades);
  const togglePrioridad = useFiltersStore((s) => s.togglePrioridad);
  const tipoAtencion = useFiltersStore((s) => s.tipoAtencion);
  const setTipoAtencion = useFiltersStore((s) => s.setTipoAtencion);
  const estado = useFiltersStore((s) => s.estado);
  const setEstado = useFiltersStore((s) => s.setEstado);
  const reset = useFiltersStore((s) => s.reset);

  const [selectorAbierto, setSelectorAbierto] = useState<'tipo' | 'estado' | null>(null);

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

      <View style={styles.dualRow}>
        <SelectorRow
          label="Tipo de atención"
          value={tipoAtencion ?? 'Todos'}
          onPress={() => setSelectorAbierto('tipo')}
        />
        <SelectorRow
          label="Estado"
          value={estado ? ESTADO_OPTIONS.find((o) => o.value === estado)?.label ?? estado : 'Todos'}
          onPress={() => setSelectorAbierto('estado')}
        />
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

      <SelectorModal
        visible={selectorAbierto === 'tipo'}
        onClose={() => setSelectorAbierto(null)}
        options={[{ value: null, label: 'Todos' }, ...TIPO_ATENCION_OPTIONS.map((t) => ({ value: t, label: t }))]}
        selected={tipoAtencion}
        onSelect={setTipoAtencion}
      />
      <SelectorModal
        visible={selectorAbierto === 'estado'}
        onClose={() => setSelectorAbierto(null)}
        options={[{ value: null, label: 'Todos' }, ...ESTADO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
        selected={estado}
        onSelect={setEstado}
      />
    </View>
  );
}

function SelectorRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable style={styles.selectorBox} onPress={onPress}>
      <View style={styles.selectorHeaderRow}>
        <Text style={styles.selectorLabel}>{label}</Text>
        <Text style={styles.selectorChevron}>›</Text>
      </View>
      <Text style={styles.selectorValue}>{value}</Text>
    </Pressable>
  );
}

function SelectorModal<T extends string | null>({
  visible,
  onClose,
  options,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalCard}>
          {options.map((opt) => (
            <Pressable
              key={String(opt.value)}
              style={styles.modalOption}
              onPress={() => {
                onSelect(opt.value);
                onClose();
              }}
            >
              <Text style={[styles.modalOptionLabel, selected === opt.value && styles.modalOptionLabelActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
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
  dualRow: { flexDirection: 'row', gap: Spacing.xs },
  selectorBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    gap: 2,
  },
  selectorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectorLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  selectorChevron: { color: Colors.textMuted, fontSize: 15 },
  selectorValue: { color: Colors.textBody, fontSize: 13, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 43, 82, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: 240,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalOption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  modalOptionLabel: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  modalOptionLabelActive: { color: Colors.accent },
});
