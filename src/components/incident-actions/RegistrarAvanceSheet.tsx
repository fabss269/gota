import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { TecnicoOptionsList } from '@/components/incident-actions/TecnicoOptionsList';
import {
  AREA_OPTIONS,
  EQUIPO_OPTIONS,
  MOTIVOS_AVANCE,
  type MotivoAvance,
  type TransicionEstado,
} from '@/mocks/estadoWorkflowMock';
import type { Usuario } from '@/mocks/usuariosMock';
import { useRegistrarAvance } from '@/hooks/useRegistrarAvance';
import { useReasignarResponsable } from '@/hooks/useReasignarResponsable';

type Props = {
  visible: boolean;
  incidenciaId: string;
  incidenciaLabel: string;
  transicion: TransicionEstado | null;
  tecnicoActualId?: string;
  onClose: () => void;
  onRegistrado: () => void;
};

/** Overlay - Registrar Avance (Spec 07, RF-07.3 a RF-07.7).
 *
 * Los campos que aparecen debajo de "¿Qué pasó?" dependen del motivo elegido (es un
 * grupo de un solo valor, no multi-select): "Requiere equipo" muestra un segundo
 * selector de equipo, "Derivar a otra área" un selector de área, y "Reasignar técnico"
 * la misma lista de técnicos que usa `SeleccionarResponsableSheet` (vía
 * `TecnicoOptionsList`), en vez de encadenar un segundo modal aparte como antes.
 *
 * Simplificación documentada: no existe un campo propio en `POST /incidencias/{id}/avances`
 * (docs/API.md § 5) para "equipo"/"área" todavía, así que se anexan como texto a la
 * nota en vez de inventar un campo nuevo en el mock.
 */
export function RegistrarAvanceSheet({
  visible,
  incidenciaId,
  incidenciaLabel,
  transicion,
  tecnicoActualId,
  onClose,
  onRegistrado,
}: Props) {
  const [motivo, setMotivo] = useState<MotivoAvance | null>(null);
  const [equipo, setEquipo] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [tecnico, setTecnico] = useState<Usuario | null>(null);
  const [nota, setNota] = useState('');
  const registrarAvance = useRegistrarAvance();
  const reasignarResponsable = useReasignarResponsable();

  // Mismo fix de animación que CambiarEstadoSheet: el backdrop solo aparece (fade), la
  // hoja se desliza — desacoplados para que el fondo no "suba" como un rectángulo.
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(500);
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 180 });
      sheetTranslateY.value = withTiming(0, { duration: 280 });
    } else {
      backdropOpacity.value = 0;
      sheetTranslateY.value = 500;
    }
  }, [visible, backdropOpacity, sheetTranslateY]);
  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTranslateY.value }] }));

  const resetAndClose = () => {
    setMotivo(null);
    setEquipo(null);
    setArea(null);
    setTecnico(null);
    setNota('');
    onClose();
  };

  const faltaCampoDependiente =
    (motivo === 'REQUIERE_EQUIPO' && !equipo) ||
    (motivo === 'DERIVAR_OTRA_AREA' && !area) ||
    (motivo === 'REASIGNAR_TECNICO' && !tecnico);

  const handleConfirm = () => {
    if (!motivo || !transicion || faltaCampoDependiente) return;

    const notaFinal = [
      motivo === 'REQUIERE_EQUIPO' && equipo ? `Equipo requerido: ${equipo}.` : null,
      motivo === 'DERIVAR_OTRA_AREA' && area ? `Área: ${area}.` : null,
      nota.trim() || null,
    ]
      .filter(Boolean)
      .join(' ');

    registrarAvance.mutate(
      { id: incidenciaId, motivo, nota: notaFinal, siguienteEstado: transicion.hacia },
      {
        onSuccess: () => {
          if (motivo === 'REASIGNAR_TECNICO' && tecnico) {
            reasignarResponsable.mutate({ id: incidenciaId, usuario: tecnico });
          }
          resetAndClose();
          onRegistrado();
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
                <Text style={styles.title}>Registrar avance</Text>
                <Pressable style={styles.closeBtn} onPress={resetAndClose}>
                  <Text style={styles.closeGlyph}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.subtitle}>{incidenciaLabel}</Text>

              <Text style={styles.sectionLabel}>¿QUÉ PASÓ?</Text>
              <View style={styles.grid}>
                {MOTIVOS_AVANCE.map((m) => (
                  <Chip
                    key={m.value}
                    label={m.label}
                    active={motivo === m.value}
                    onPress={() => setMotivo(m.value)}
                  />
                ))}
              </View>

              {motivo === 'REQUIERE_EQUIPO' && (
                <>
                  <Text style={styles.sectionLabel}>¿Qué pasó?</Text>
                  <View style={styles.grid}>
                    {EQUIPO_OPTIONS.map((opt) => (
                      <Chip key={opt} label={opt} active={equipo === opt} onPress={() => setEquipo(opt)} />
                    ))}
                  </View>
                </>
              )}

              {motivo === 'DERIVAR_OTRA_AREA' && (
                <>
                  <Text style={styles.sectionLabel}>Área:</Text>
                  <View style={styles.grid}>
                    {AREA_OPTIONS.map((opt) => (
                      <Chip key={opt} label={opt} active={area === opt} onPress={() => setArea(opt)} />
                    ))}
                  </View>
                </>
              )}

              {motivo === 'REASIGNAR_TECNICO' && (
                <>
                  <Text style={styles.sectionLabel}>REASIGNAR A</Text>
                  <TecnicoOptionsList selectedId={tecnico?.id ?? tecnicoActualId} onSelect={setTecnico} />
                </>
              )}

              <Text style={styles.sectionLabel}>NOTA (OPCIONAL)</Text>
              <TextInput
                value={nota}
                onChangeText={setNota}
                placeholder="Solo si hace falta un detalle extra..."
                placeholderTextColor={Colors.textMuted}
                style={styles.notaBox}
                multiline
              />

              <View style={styles.buttonsRow}>
                <Pressable style={styles.cancelBtn} onPress={resetAndClose}>
                  <Text style={styles.cancelLabel}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, (!motivo || faltaCampoDependiente) && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={!motivo || faltaCampoDependiente || registrarAvance.isPending}
                >
                  <Text style={styles.confirmLabel}>Registrar avance</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
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
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E3E4E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  subtitle: { fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.xs },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginTop: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipLabel: { fontSize: 11, fontWeight: '600', color: Colors.textBody },
  chipLabelActive: { color: Colors.white },
  notaBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    minHeight: 70,
    fontSize: 12.5,
    color: Colors.textBody,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  buttonsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelLabel: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    alignItems: 'center',
    paddingVertical: 12,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmLabel: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
