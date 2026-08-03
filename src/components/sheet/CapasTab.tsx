import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { UbicacionPicker } from '@/components/map/UbicacionPicker';
import { type CapaKey, useCapasStore } from '@/state/capasStore';

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

/** Tab "Capas" del Bottom Sheet — versión móvil. Ver FiltersSidebar.tsx para la versión web. */
export function CapasTab({ onAplicar }: { onAplicar: () => void }) {
  const capasVisibles = useCapasStore((s) => s.capasVisibles);
  const isApplying = useCapasStore((s) => s.isApplying);
  const aplicarCapas = useCapasStore((s) => s.aplicarCapas);
  const setApplying = useCapasStore((s) => s.setApplying);

  const [seleccion, setSeleccion] = useState<Set<CapaKey>>(new Set(capasVisibles));

  const toggle = (key: CapaKey) =>
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const handleAplicar = () => {
    aplicarCapas(new Set(seleccion));
    setApplying(true);
    onAplicar();
  };

  // Red de seguridad: si el mapa (solo web hoy) no confirma que terminó de renderizar
  // las capas nuevas, el botón no debe quedar cargando para siempre.
  useEffect(() => {
    if (!isApplying) return;
    const timeout = setTimeout(() => setApplying(false), 4000);
    return () => clearTimeout(timeout);
  }, [isApplying, setApplying]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ubicación</Text>
      <UbicacionPicker />

      <CapaGroup title="Predio" dotColor={Colors.textMuted} items={PREDIO_CAPAS} seleccion={seleccion} onToggle={toggle} />
      <CapaGroup title="Agua" dotColor={Colors.agua} items={AGUA_CAPAS} seleccion={seleccion} onToggle={toggle} />
      <CapaGroup
        title="Alcantarillado"
        dotColor={Colors.desague}
        items={DESAGUE_CAPAS}
        seleccion={seleccion}
        onToggle={toggle}
      />

      <Pressable style={styles.applyButton} onPress={handleAplicar} disabled={isApplying}>
        {isApplying ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.applyButtonLabel}>Ver en el mapa</Text>
        )}
      </Pressable>
    </View>
  );
}

function CapaGroup({
  title,
  dotColor,
  items,
  seleccion,
  onToggle,
}: {
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

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark, marginTop: Spacing.sm },
  group: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 6,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  groupTitle: { fontWeight: '700', color: Colors.textBody },
  dot: { width: 8, height: 8, borderRadius: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkboxDisabled: { opacity: 0.4 },
  checkmark: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: Colors.textBody },
  checkboxLabelDisabled: { color: Colors.textMuted, fontStyle: 'italic' },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  applyButtonLabel: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
