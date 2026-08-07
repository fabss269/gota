import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type CapaCatastro =
  | 'agua'
  | 'alcantarillado'
  | 'alcantarillado_flujo'
  | 'cajaagua'
  | 'cajadesague'
  | 'cajaaguaconexion'
  | 'cajadesagueconexion'
  | 'accesorios'
  | 'lotes'
  | 'manzanas';

type Props = {
  activas: Record<CapaCatastro, boolean>;
  onToggle: (capa: CapaCatastro) => void;
};

const CAPAS: { id: CapaCatastro; label: string; color: string }[] = [
  { id: 'agua', label: 'Red de agua', color: '#1E40AF' },
  { id: 'alcantarillado', label: 'Red de alcantarillado', color: '#166534' },
  { id: 'alcantarillado_flujo', label: 'Flujo de alcantarillado', color: '#059669' },
  { id: 'cajaagua', label: 'Cajas de agua', color: '#3B82F6' },
  { id: 'cajadesague', label: 'Cajas de desagüe', color: '#22C55E' },
  { id: 'cajaaguaconexion', label: 'Conexiones de agua', color: '#60A5FA' },
  { id: 'cajadesagueconexion', label: 'Conexiones de desagüe', color: '#4ADE80' },
  { id: 'accesorios', label: 'Accesorios', color: '#EAB308' },
  { id: 'lotes', label: 'Lotes', color: '#8B5CF6' },
  { id: 'manzanas', label: 'Manzanas', color: '#EC4899' },
];

export function LayersPanel({ activas, onToggle }: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Ionicons name="layers-outline" size={14} color={Colors.textBody} />
        <Text style={styles.titulo}>Capas catastrales</Text>
      </View>
      {CAPAS.map((c) => {
        const on = activas[c.id];
        return (
          <Pressable key={c.id} style={styles.item} onPress={() => onToggle(c.id)}>
            <View style={[styles.checkbox, on && styles.checkboxOn]}>
              {on && <Ionicons name="checkmark" size={12} color={Colors.white} />}
            </View>
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <Text style={styles.label}>{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 190,
    zIndex: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titulo: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textBody,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    color: Colors.textBody,
    flex: 1,
  },
});
