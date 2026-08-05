import { useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import type { Incidencia, Prioridad } from '@/mocks/incidentsMock';
import { useThemeColors } from '@/state/themeStore';

type Props = {
  visible: boolean;
  incidencias: Incidencia[];
  onSelect: (incidencia: Incidencia) => void;
  onClose: () => void;
};

/**
 * Bottom sheet para elegir una incidencia cuando un marcador del mapa agrupa varias —
 * mismo punto o muy cerca (radio de `clusterIncidents.ts`), pero son entidades
 * `incidente` genuinamente distintas (ej. mismo suministro, tipo de problema
 * diferente — el dedup del backend agrupa por suministro+tipo, no las mezcla).
 * Reemplaza el `Alert.alert` de solo-texto que había antes (no navegaba a ningún
 * lado). Mismo patrón visual/de animación que CambiarEstadoSheet.
 */
export function ClusterListSheet({ visible, incidencias, onSelect, onClose }: Props) {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const PRIORIDAD_COLOR: Record<Prioridad, string> = {
    a_tiempo: t.statusATiempo,
    alerta: t.statusAlerta,
    critica: t.statusCritica,
  };
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(400);
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 180 });
      sheetTranslateY.value = withTiming(0, { duration: 280 });
    } else {
      backdropOpacity.value = 0;
      sheetTranslateY.value = 400;
    }
  }, [visible, backdropOpacity, sheetTranslateY]);
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTranslateY.value }] }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropColor, backdropAnimatedStyle]} />
        <Pressable style={styles.backdropTouchable} onPress={onClose}>
          <Animated.View style={sheetAnimatedStyle}>
            <Pressable style={styles.sheet}>
              <Text style={styles.title}>{incidencias.length} incidencias en este punto</Text>
              <Text style={styles.subtitle}>Tocá una para ver su detalle</Text>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {incidencias.map((inc) => (
                  <Pressable key={inc.id} style={styles.item} onPress={() => onSelect(inc)}>
                    <View style={[styles.prioridadDot, { backgroundColor: PRIORIDAD_COLOR[inc.prioridad] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTipo}>{inc.tipo}</Text>
                      <Text style={styles.itemDireccion}>{inc.direccion}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1 },
    backdropColor: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13, 43, 82, 0.25)' },
    backdropTouchable: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      padding: Spacing.md,
      maxHeight: '75%',
    },
    title: { fontSize: 16, fontWeight: '800', color: t.primaryDark },
    subtitle: { fontSize: 12, color: t.textMuted, marginTop: 2, marginBottom: Spacing.sm },
    list: { flexGrow: 0 },
    listContent: { gap: Spacing.xs, paddingBottom: Spacing.sm },
    item: {
      backgroundColor: t.border,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    prioridadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    itemTipo: { fontSize: 13, fontWeight: '700', color: t.textBody },
    itemDireccion: { fontSize: 11, color: t.textMuted, marginTop: 2 },
    chevron: { fontSize: 18, color: t.textMuted, flexShrink: 0 },
  });
}
