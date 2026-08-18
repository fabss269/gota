import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useRegistrarAvance } from '@/hooks/useRegistrarAvance';
import { useThemeColors } from '@/state/themeStore';

type Props = {
  visible: boolean;
  incidenciaId: string;
  incidenciaLabel: string;
  onClose: () => void;
  onCulminado: () => void;
};

/**
 * "Finalizar" del diagrama de estados (Edgar 2026-08-12): EN_PROGRESO→ATENDIDO.
 * Distinto de `RegistrarAvanceSheet` — no hay motivo que elegir, solo una nota
 * opcional. Internamente usa el mismo `POST /avances` con `motivo: 'SE_RESOLVIO'`
 * (mapea a ATENDIDO en el backend, `MOTIVO_ESTADO`) para poder guardar la nota —
 * `PATCH /estado` no tiene campo de nota.
 */
export function CulminarAtencionDialog({ visible, incidenciaId, incidenciaLabel, onClose, onCulminado }: Props) {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [nota, setNota] = useState('');
  const registrarAvance = useRegistrarAvance();

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

  const resetAndClose = () => {
    setNota('');
    onClose();
  };

  const handleConfirm = () => {
    registrarAvance.mutate(
      { id: incidenciaId, motivo: 'SE_RESOLVIO', nota: nota.trim(), siguienteEstado: 'ATENDIDO' },
      {
        onSuccess: () => {
          setNota('');
          onCulminado();
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={resetAndClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropColor, backdropAnimatedStyle]} />
        <Pressable style={styles.backdropTouchable} onPress={resetAndClose}>
          <Animated.View style={sheetAnimatedStyle}>
            <Pressable style={styles.sheet}>
              <View style={styles.head}>
                <Text style={styles.title}>Culminar atención</Text>
                <Pressable style={styles.closeBtn} onPress={resetAndClose}>
                  <Text style={styles.closeGlyph}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.subtitle}>{incidenciaLabel}</Text>

              <Text style={styles.sectionLabel}>NOTA (OPCIONAL)</Text>
              <TextInput
                value={nota}
                onChangeText={setNota}
                placeholder="Detalle de la solución, si hace falta..."
                placeholderTextColor={t.textMuted}
                style={styles.notaBox}
                multiline
                autoFocus
              />

              <View style={styles.buttonsRow}>
                <Pressable style={styles.cancelBtn} onPress={resetAndClose}>
                  <Text style={styles.cancelLabel}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, registrarAvance.isPending && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={registrarAvance.isPending}
                >
                  <Text style={styles.confirmLabel}>
                    {registrarAvance.isPending ? 'Guardando…' : 'Culminar atención'}
                  </Text>
                </Pressable>
              </View>
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
      gap: Spacing.xs,
    },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 15, fontWeight: '700', color: t.primaryDark },
    closeBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeGlyph: { fontSize: 14, fontWeight: '700', color: t.textMuted },
    subtitle: { fontSize: 11, color: t.textMuted, marginBottom: Spacing.xs },
    sectionLabel: { fontSize: 10, fontWeight: '700', color: t.textMuted, marginTop: Spacing.sm },
    notaBox: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      minHeight: 80,
      fontSize: 12.5,
      color: t.textBody,
      textAlignVertical: 'top',
      marginTop: 4,
    },
    buttonsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    cancelBtn: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: t.accent,
      borderRadius: Radius.pill,
      alignItems: 'center',
      paddingVertical: 12,
    },
    cancelLabel: { color: t.accent, fontWeight: '700', fontSize: 13 },
    confirmBtn: {
      flex: 1,
      backgroundColor: t.statusATiempo,
      borderRadius: Radius.pill,
      alignItems: 'center',
      paddingVertical: 12,
    },
    confirmBtnDisabled: { opacity: 0.4 },
    confirmLabel: { color: t.white, fontWeight: '700', fontSize: 13 },
  });
}
