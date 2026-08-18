import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useFiltersStore, type MapMode } from '@/state/filtersStore';
import { useThemeColors, useThemeStore, type ThemeMode } from '@/state/themeStore';

const OPTIONS: { mode: MapMode; label: string; hint: string }[] = [
  { mode: 'normal', label: 'Mapa normal', hint: 'Vista estándar' },
  { mode: 'calor', label: 'Mapa de calor', hint: 'Zonas de mayor incidencia' },
  { mode: 'foco', label: 'Mapa de foco', hint: 'Agrupación por causa probable' },
];

const THEME_OPTIONS: { mode: ThemeMode; label: string; hint: string }[] = [
  { mode: 'light', label: 'Modo claro', hint: 'Predeterminado' },
  { mode: 'dark', label: 'Modo oscuro', hint: 'Mapa y paneles en oscuro' },
];

type Props = { visible: boolean; onClose: () => void };

/** Overlay - Selector Mapa (Spec 03, RF-03.6) — incluye también el switch de modo
 * oscuro (pedido de Edgar 2026-08-05, alcance Mapa): conceptualmente es "cómo se ve
 * el mapa", mismo lugar que el resto de las variantes visuales. */
export function MapModeSheet({ visible, onClose }: Props) {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const mapMode = useFiltersStore((s) => s.mapMode);
  const setMapMode = useFiltersStore((s) => s.setMapMode);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

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

          <View style={styles.divider} />

          {THEME_OPTIONS.map((opt) => (
            <Pressable
              key={opt.mode}
              style={styles.option}
              onPress={() => {
                setThemeMode(opt.mode);
                onClose();
              }}
            >
              <Text style={[styles.label, themeMode === opt.mode && styles.labelActive]}>{opt.label}</Text>
              <Text style={styles.hint}>{opt.hint}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(13, 43, 82, 0.25)',
      justifyContent: 'flex-end',
      paddingBottom: 96,
      paddingLeft: Spacing.md,
    },
    card: {
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
    option: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    label: {
      fontSize: 15,
      fontWeight: '700',
      color: t.primaryDark,
    },
    labelActive: {
      color: t.accent,
    },
    hint: {
      fontSize: 12,
      color: t.textMuted,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: t.border,
      marginVertical: 4,
      marginHorizontal: Spacing.md,
    },
  });
}
