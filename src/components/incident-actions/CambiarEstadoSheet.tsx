import { useEffect } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { getTransicionesDisponibles, type TransicionEstado } from '@/mocks/estadoWorkflowMock';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';
import { useCambiarEstado } from '@/hooks/useCambiarEstado';

const ESTADO_COLOR: Record<EstadoIncidencia, string> = {
  CREADO: Colors.textMuted,
  PENDIENTE: Colors.accent,
  EN_PROGRESO: Colors.accent,
  ATENDIDO: '#1A7D3A',
};

type Props = {
  visible: boolean;
  incidenciaId: string;
  estado: EstadoIncidencia;
  onClose: () => void;
  onAbrirAvance: (transicion: TransicionEstado) => void;
};

/** Overlay - Cambiar Estado (Spec 07, RF-07.1, RF-07.2). */
export function CambiarEstadoSheet({ visible, incidenciaId, estado, onClose, onAbrirAvance }: Props) {
  const cambiarEstado = useCambiarEstado();
  const transiciones = getTransicionesDisponibles(estado);

  // El backdrop debe solo aparecer (fade), no deslizarse como rectángulo junto con la
  // hoja — animationType="slide" de <Modal> animaba ambos juntos porque el backdrop
  // (flex:1) es parte del mismo árbol que se traslada. Se separan con Reanimated:
  // <Modal animationType="none"> + backdrop (opacity) y hoja (translateY) independientes.
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

  const handlePress = (transicion: TransicionEstado) => {
    if (transicion.requiereFormulario) {
      onClose();
      onAbrirAvance(transicion);
      return;
    }
    Alert.alert('Marcar como atendido', '¿Confirmas que esta incidencia fue atendida?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          cambiarEstado.mutate({ id: incidenciaId, estado: transicion.hacia });
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropColor, backdropAnimatedStyle]} />
        <Pressable style={styles.backdropTouchable} onPress={onClose}>
          <Animated.View style={sheetAnimatedStyle}>
            <Pressable style={styles.sheet}>
              <Text style={styles.title}>Cambiar estado</Text>
              {transiciones.length === 0 && <Text style={styles.emptyText}>Esta incidencia ya fue atendida.</Text>}
              {transiciones.map((t, i) => (
                <Pressable key={`${t.desde}-${t.hacia}-${i}`} style={styles.item} onPress={() => handlePress(t)}>
                  <Text style={styles.itemLabel}>{t.label}</Text>
                  <Text style={[styles.itemTarget, { color: ESTADO_COLOR[t.hacia] }]}>
                    → {t.hacia.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </Pressable>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdropColor: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13, 43, 82, 0.25)' },
  backdropTouchable: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  title: { fontSize: 16, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.xs },
  emptyText: { fontSize: 13, color: Colors.textMuted, paddingVertical: Spacing.sm },
  item: {
    backgroundColor: '#F4F6FB',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  itemLabel: { fontSize: 13, fontWeight: '700', color: Colors.textBody },
  itemTarget: { fontSize: 11, fontWeight: '600' },
});
