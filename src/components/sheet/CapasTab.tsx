import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type CapaKey =
  | 'red_potable'
  | 'valvulas'
  | 'grifos_contra_incendio'
  | 'red_primaria_desague'
  | 'red_secundaria_desague'
  | 'buzones';

const AGUA_CAPAS: { key: CapaKey; label: string }[] = [
  { key: 'red_potable', label: 'Red potable' },
  { key: 'valvulas', label: 'Válvulas' },
  { key: 'grifos_contra_incendio', label: 'Grifos contra incendio' },
];

const DESAGUE_CAPAS: { key: CapaKey; label: string }[] = [
  { key: 'red_primaria_desague', label: 'Red primaria' },
  { key: 'red_secundaria_desague', label: 'Red secundaria' },
  { key: 'buzones', label: 'Buzones' },
];

/**
 * Tab "Capas" del Bottom Sheet (Spec 04, RF-04.7 a RF-04.10).
 *
 * Simplificación documentada: "Ver en el mapa" (RF-04.10) hoy solo cierra el sheet.
 * Dibujar las líneas de red reales sobre MapLibre requiere el endpoint
 * `GET /red/capas` (docs/API.md § 7), que aún no existe — no hay una geometría real
 * que mockear de forma creíble sin inventar trazados de red que no vienen del diseño.
 */
export function CapasTab({ onAplicar }: { onAplicar: () => void }) {
  const [seleccion, setSeleccion] = useState<Set<CapaKey>>(new Set(['red_potable', 'valvulas']));

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

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ubicación</Text>
      <View style={styles.disabledRow}>
        <Text style={styles.disabledLabel}>Chiclayo · Todos los distritos · Todos los sectores</Text>
      </View>

      <CapaGroup title="Agua" dotColor={Colors.agua} items={AGUA_CAPAS} seleccion={seleccion} onToggle={toggle} />
      <CapaGroup
        title="Desagüe"
        dotColor={Colors.desague}
        items={DESAGUE_CAPAS}
        seleccion={seleccion}
        onToggle={toggle}
      />

      <Pressable style={styles.applyButton} onPress={onAplicar}>
        <Text style={styles.applyButtonLabel}>Ver en el mapa</Text>
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
  items: { key: CapaKey; label: string }[];
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
        <Pressable key={item.key} style={styles.checkboxRow} onPress={() => onToggle(item.key)}>
          <View style={[styles.checkbox, seleccion.has(item.key) && styles.checkboxChecked]}>
            {seleccion.has(item.key) && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark, marginTop: Spacing.sm },
  disabledRow: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
  },
  disabledLabel: { color: Colors.textMuted, fontSize: 13 },
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
  checkmark: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: Colors.textBody },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  applyButtonLabel: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
