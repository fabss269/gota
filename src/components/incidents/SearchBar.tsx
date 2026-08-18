import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

const DEBOUNCE_MS = 300;

type Props = {
  onDebouncedChange: (value: string) => void;
};

/** Buscador de la Lista de Incidencias (Spec 05, RF-05.2). */
export function SearchBar({ onDebouncedChange }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => onDebouncedChange(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Buscar por tipo (ej. Atoro en colector)"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  icon: { fontSize: 14 },
  input: { flex: 1, fontSize: 13, color: Colors.textBody, padding: 0 },
});
