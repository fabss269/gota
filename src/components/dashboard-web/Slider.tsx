import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

type Props<T extends string | number> = {
  label: string;
  opciones: T[];
  valor: T;
  onChange: (v: T) => void;
  formato?: (v: T) => string;
};

/** Selector tipo pill-group compacto (para umbrales/ventanas). */
export function OptionSlider<T extends string | number>({
  label, opciones, valor, onChange, formato = String,
}: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillGroup}>
        {opciones.map((o) => (
          <Pressable
            key={String(o)}
            style={[styles.pill, valor === o && styles.pillActivo]}
            onPress={() => onChange(o)}
          >
            <Text style={[styles.pillText, valor === o && styles.pillTextActivo]}>
              {formato(o)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pillGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    padding: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  pillActivo: { backgroundColor: Colors.accent },
  pillText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  pillTextActivo: { color: Colors.white },
});
