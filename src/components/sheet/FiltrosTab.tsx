import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { UbicacionPicker } from '@/components/map/UbicacionPicker';
import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import type { EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
import { type RangoFechas, useFiltersStore } from '@/state/filtersStore';
import { useThemeColors } from '@/state/themeStore';

const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  a_tiempo: 'A tiempo',
  alerta: 'Alerta',
  critica: 'Crítica',
};

const RANGO_LABEL: Record<RangoFechas, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  mes: 'Este mes',
  todo: 'Todo',
};

// Mismos valores/labels que ya usa el resto de la app para "tipo"/"estado"
// (ver src/components/incidents/FiltersOverlay.tsx) — no existe un catálogo real
// todavía (docs/API.md § 2), así que se hardcodea igual que allá.
const TIPO_ATENCION_OPTIONS = ['Atoro en colector', 'Fuga en vereda', 'Fuga de agua', 'Falta de agua'];
const ESTADO_OPTIONS: { value: EstadoIncidencia; label: string }[] = [
  { value: 'CREADO', label: 'Registrado' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'ATENDIDO', label: 'Atendido' },
];

/**
 * Tab "Filtros" del Bottom Sheet (Spec 04, RF-04.1 a RF-04.6).
 *
 * Todo acá filtra el mapa/lista de verdad: Categoría, Prioridad, Tipo de atención,
 * Estado, Ubicación (reusa `UbicacionPicker`, el mismo componente/store que ya usa
 * la pestaña Capas y que centra la cámara — elegir un distrito/sector acá también
 * lo hace) y Rango de fechas (presets simples, no hay date-picker en el proyecto
 * todavía — ver `useIncidentsToday`).
 */
export function FiltrosTab() {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const PRIORIDAD_COLOR: Record<Prioridad, string> = {
    a_tiempo: t.statusATiempo,
    alerta: t.statusAlerta,
    critica: t.statusCritica,
  };

  const categorias = useFiltersStore((s) => s.categorias);
  const toggleCategoria = useFiltersStore((s) => s.toggleCategoria);
  const prioridades = useFiltersStore((s) => s.prioridades);
  const togglePrioridad = useFiltersStore((s) => s.togglePrioridad);
  const tipoAtencion = useFiltersStore((s) => s.tipoAtencion);
  const setTipoAtencion = useFiltersStore((s) => s.setTipoAtencion);
  const estado = useFiltersStore((s) => s.estado);
  const setEstado = useFiltersStore((s) => s.setEstado);
  const rangoFechas = useFiltersStore((s) => s.rangoFechas);
  const setRangoFechas = useFiltersStore((s) => s.setRangoFechas);
  const soloNoResueltas = useFiltersStore((s) => s.soloNoResueltas);
  const setSoloNoResueltas = useFiltersStore((s) => s.setSoloNoResueltas);
  const reset = useFiltersStore((s) => s.reset);

  const [selectorAbierto, setSelectorAbierto] = useState<'tipo' | 'estado' | 'rango' | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Categoría</Text>
        <Pressable onPress={reset}>
          <Text style={styles.limpiar}>Limpiar</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        <CategoriaChip
          styles={styles}
          icon="💧"
          label="Agua"
          active={categorias.includes('agua')}
          onPress={() => toggleCategoria('agua')}
        />
        <CategoriaChip
          styles={styles}
          icon="⚡"
          label="Desagüe"
          active={categorias.includes('desague')}
          onPress={() => toggleCategoria('desague')}
        />
      </View>

      <View style={styles.soloNoResueltasRow}>
        <Text style={styles.sectionTitle}>Solo no resueltas</Text>
        <Switch value={soloNoResueltas} onValueChange={setSoloNoResueltas} />
      </View>

      <Text style={styles.sectionTitle}>Ubicación</Text>
      <UbicacionPicker />

      <View style={styles.dualRow}>
        <SelectorRow
          styles={styles}
          label="Tipo de atención"
          value={tipoAtencion ?? 'Todos'}
          onPress={() => setSelectorAbierto('tipo')}
        />
        <SelectorRow
          styles={styles}
          label="Estado"
          value={estado ? ESTADO_OPTIONS.find((o) => o.value === estado)?.label ?? estado : 'Todos'}
          onPress={() => setSelectorAbierto('estado')}
        />
      </View>

      <Text style={styles.sectionTitle}>Prioridad</Text>
      <View style={styles.chipRow}>
        {(Object.keys(PRIORIDAD_LABEL) as Prioridad[]).map((p) => (
          <PrioridadChip
            styles={styles}
            key={p}
            label={PRIORIDAD_LABEL[p]}
            color={PRIORIDAD_COLOR[p]}
            active={prioridades.includes(p)}
            onPress={() => togglePrioridad(p)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Rango de fechas</Text>
      <SelectorRow styles={styles} label="Rango de fechas" value={RANGO_LABEL[rangoFechas]} onPress={() => setSelectorAbierto('rango')} hideLabel />

      <SelectorModal
        styles={styles}
        visible={selectorAbierto === 'tipo'}
        onClose={() => setSelectorAbierto(null)}
        options={[{ value: null, label: 'Todos' }, ...TIPO_ATENCION_OPTIONS.map((t) => ({ value: t, label: t }))]}
        selected={tipoAtencion}
        onSelect={setTipoAtencion}
      />
      <SelectorModal
        styles={styles}
        visible={selectorAbierto === 'estado'}
        onClose={() => setSelectorAbierto(null)}
        options={[{ value: null, label: 'Todos' }, ...ESTADO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
        selected={estado}
        onSelect={setEstado}
      />
      <SelectorModal
        styles={styles}
        visible={selectorAbierto === 'rango'}
        onClose={() => setSelectorAbierto(null)}
        options={(Object.keys(RANGO_LABEL) as RangoFechas[]).map((r) => ({ value: r, label: RANGO_LABEL[r] }))}
        selected={rangoFechas}
        onSelect={setRangoFechas}
      />
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function SelectorRow({
  styles,
  label,
  value,
  onPress,
  hideLabel,
}: {
  styles: Styles;
  label: string;
  value: string;
  onPress: () => void;
  hideLabel?: boolean;
}) {
  return (
    <Pressable style={styles.selectorBox} onPress={onPress}>
      <View style={styles.selectorHeaderRow}>
        {!hideLabel && <Text style={styles.selectorLabel}>{label}</Text>}
        <Text style={styles.selectorChevron}>›</Text>
      </View>
      <Text style={styles.selectorValue}>{value}</Text>
    </Pressable>
  );
}

function SelectorModal<T extends string | null>({
  styles,
  visible,
  onClose,
  options,
  selected,
  onSelect,
}: {
  styles: Styles;
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

function CategoriaChip({
  styles,
  icon,
  label,
  active,
  onPress,
}: {
  styles: Styles;
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.categoriaChip, active && styles.categoriaChipActive]} onPress={onPress}>
      <Text style={styles.categoriaIcon}>{icon}</Text>
      <Text style={[styles.categoriaLabel, active && styles.categoriaLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function PrioridadChip({
  styles,
  label,
  color,
  active,
  onPress,
}: {
  styles: Styles;
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.prioridadChip, { borderTopColor: color }, !active && styles.prioridadChipInactive]} onPress={onPress}>
      <Text style={[styles.prioridadLabel, !active && styles.prioridadLabelInactive]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    container: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    soloNoResueltasRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: t.primaryDark, marginTop: Spacing.sm },
    limpiar: { color: t.accent, fontWeight: '600' },
    chipRow: { flexDirection: 'row', gap: Spacing.xs },

    categoriaChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.background,
    },
    categoriaChipActive: { backgroundColor: t.primaryDark, borderColor: t.primaryDark },
    categoriaIcon: { fontSize: 14 },
    categoriaLabel: { fontSize: 14, fontWeight: '700', color: t.textBody },
    categoriaLabelActive: { color: t.white },

    prioridadChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      borderTopWidth: 3,
      backgroundColor: t.surface,
    },
    prioridadChipInactive: { opacity: 0.45 },
    prioridadLabel: { fontSize: 12, fontWeight: '700', color: t.textBody },
    prioridadLabelInactive: { color: t.textMuted },

    dualRow: { flexDirection: 'row', gap: Spacing.xs },
    selectorBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      gap: 2,
    },
    selectorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectorLabel: { color: t.textMuted, fontSize: 11, fontWeight: '700' },
    selectorChevron: { color: t.textMuted, fontSize: 15 },
    selectorValue: { color: t.textBody, fontSize: 13, fontWeight: '600' },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(13, 43, 82, 0.25)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: 240,
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    modalOption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    modalOptionLabel: { fontSize: 15, fontWeight: '700', color: t.primaryDark },
    modalOptionLabelActive: { color: t.accent },
  });
}
