import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { UbicacionPicker } from '@/components/map/UbicacionPicker';
import { type CapaKey, useCapasStore } from '@/state/capasStore';
import { useThemeColors } from '@/state/themeStore';

const PREDIO_CAPAS: { key: CapaKey; label: string }[] = [
  { key: 'manzanas', label: 'Manzanas' },
  { key: 'lotes', label: 'Lotes' },
];

const AGUA_CAPAS: { key: CapaKey; label: string }[] = [
  { key: 'red_potable', label: 'Red de agua potable' },
  { key: 'accesorios', label: 'Accesorios (válvulas, codos, tees)' },
];

const DESAGUE_CAPAS: { key: CapaKey; label: string }[] = [
  { key: 'red_primaria_desague', label: 'Red primaria (colectores)' },
  { key: 'red_secundaria_desague', label: 'Red secundaria' },
  { key: 'buzones', label: 'Buzones' },
];

const INFRAESTRUCTURA_CAPAS: { key: CapaKey; label: string }[] = [
  { key: 'reservorios', label: 'Reservorios (tanques elevado/apoyado)' },
];

/** Tab "Capas" del Bottom Sheet — versión móvil. Ver FiltersSidebar.tsx para la versión web. */
export function CapasTab() {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const capasVisibles = useCapasStore((s) => s.capasVisibles);
  const aplicarCapas = useCapasStore((s) => s.aplicarCapas);

  // Cada toggle aplica directo al store (mismo patrón que FiltersSidebar.tsx en web) —
  // ya no hay selección local en borrador ni botón "Ver en el mapa": el guard
  // agregado en MapView.web.tsx (compara valor actual antes de escribir, ver fix del
  // loop infinito de 'styledata') hace que aplicar en cada toque sea barato, no hace
  // falta batchear varios cambios detrás de un botón de confirmación.
  const toggle = (key: CapaKey) => {
    const next = new Set(capasVisibles);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    aplicarCapas(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ubicación</Text>
      <UbicacionPicker />

      <CapaGroup styles={styles} title="Predio" dotColor={t.textMuted} items={PREDIO_CAPAS} seleccion={capasVisibles} onToggle={toggle} />
      <CapaGroup styles={styles} title="Agua" dotColor={Colors.agua} items={AGUA_CAPAS} seleccion={capasVisibles} onToggle={toggle} />
      <CapaGroup
        styles={styles}
        title="Alcantarillado"
        dotColor={Colors.desague}
        items={DESAGUE_CAPAS}
        seleccion={capasVisibles}
        onToggle={toggle}
      />
      <CapaGroup
        styles={styles}
        title="Infraestructura no lineal"
        dotColor={Colors.primary}
        items={INFRAESTRUCTURA_CAPAS}
        seleccion={capasVisibles}
        onToggle={toggle}
      />
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function CapaGroup({
  styles,
  title,
  dotColor,
  items,
  seleccion,
  onToggle,
}: {
  styles: Styles;
  title: string;
  dotColor: string;
  items: { key: CapaKey; label: string; disabled?: boolean }[];
  seleccion: Set<CapaKey>;
  onToggle: (key: CapaKey) => void;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.groupTitle}>{title}</Text>
      </View>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={styles.checkboxRow}
          onPress={() => !item.disabled && onToggle(item.key)}
          disabled={item.disabled}
        >
          <View
            style={[
              styles.checkbox,
              seleccion.has(item.key) && !item.disabled && styles.checkboxChecked,
              item.disabled && styles.checkboxDisabled,
            ]}
          >
            {seleccion.has(item.key) && !item.disabled && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.checkboxLabel, item.disabled && styles.checkboxLabelDisabled]}>
            {item.label}
            {item.disabled ? ' (sin datos aún)' : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    container: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: t.primaryDark, marginTop: Spacing.sm },
    group: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      gap: 6,
    },
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    groupTitle: { fontWeight: '700', color: t.textBody },
    dot: { width: 8, height: 8, borderRadius: 4 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: t.accent, borderColor: t.accent },
    checkboxDisabled: { opacity: 0.4 },
    checkmark: { color: t.white, fontSize: 12, fontWeight: '700' },
    checkboxLabel: { fontSize: 14, color: t.textBody },
    checkboxLabelDisabled: { color: t.textMuted, fontStyle: 'italic' },
  });
}
