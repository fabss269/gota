import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useFiltersStore, type MapMode } from '@/state/filtersStore';

const OPTIONS: { mode: MapMode; label: string; hint: string }[] = [
  { mode: 'normal', label: 'Mapa normal', hint: 'Vista estándar' },
  { mode: 'calor', label: 'Mapa de calor', hint: 'Zonas de mayor incidencia' },
  { mode: 'foco', label: 'Mapa de foco', hint: 'Agrupación por causa probable' },
];

type Props = { visible: boolean; onClose: () => void };

/** Overlay - Selector Mapa (Spec 03, RF-03.6). */
export function MapModeSheet({ visible, onClose }: Props) {
  const mapMode = useFiltersStore((s) => s.mapMode);
  const setMapMode = useFiltersStore((s) => s.setMapMode);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.card}>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.mode}
              style={styles.option}
              onPress={() => {
                setMapMode(opt.mode);
                onClose();
              }}
            >
              <Text style={[styles.label, mapMode === opt.mode && styles.labelActive]}>{opt.label}</Text>
              <Text style={styles.hint}>{opt.hint}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 43, 82, 0.25)',
    justifyContent: 'flex-end',
    paddingBottom: 96,
    paddingLeft: Spacing.md,
  },
  card: {
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
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  labelActive: {
    color: Colors.accent,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
