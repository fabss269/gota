import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Option<T extends string> = { value: T; label: string; dotColor?: string };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  selected: T[];
  onToggle: (value: T) => void;
};

/** Chip desplegable multi-select (Spec 05, RF-05.3 — chips "Prioridad" y "Estado"). */
export function ChipMultiSelect<T extends string>({ label, options, selected, onToggle }: Props<T>) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === options.length;

  return (
    <>
      <Pressable style={styles.chip} onPress={() => setOpen(true)}>
        <Text style={styles.chipLabel}>{label} ▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>{label}</Text>
            <OptionRow
              label="Todos"
              checked={allSelected}
              onPress={() => options.forEach((o) => (selected.includes(o.value) ? null : onToggle(o.value)))}
            />
            {options.map((opt) => (
              <OptionRow
                key={opt.value}
                label={opt.label}
                dotColor={opt.dotColor}
                checked={selected.includes(opt.value)}
                onPress={() => onToggle(opt.value)}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function OptionRow({
  label,
  checked,
  onPress,
  dotColor,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  dotColor?: string;
}) {
  return (
    <Pressable style={styles.optionRow} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  chipLabel: { fontSize: 11.5, fontWeight: '600', color: Colors.textBody },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 43, 82, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 240,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, marginBottom: Spacing.xs },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: 6 },
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  optionLabel: { fontSize: 14, color: Colors.textBody },
});
