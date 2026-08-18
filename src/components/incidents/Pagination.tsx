import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
};

/** Paginación de la Lista de Incidencias (Spec 05, RF-05.6): `< 1 2 3 >`. */
export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <View style={styles.row}>
      <PageButton label="<" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      {pages.map((p) => (
        <PageButton key={p} label={String(p)} active={p === page} onPress={() => onChange(p)} />
      ))}
      <PageButton label=">" disabled={page >= totalPages} onPress={() => onChange(page + 1)} />
    </View>
  );
}

function PageButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.btn, active && styles.btnActive, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || active}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E3E4E8',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  btnDisabled: { opacity: 0.4 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textBody },
  labelActive: { color: Colors.white },
});
