import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useReasignarResponsable } from '@/hooks/useReasignarResponsable';
import { TecnicoOptionsList } from '@/components/incident-actions/TecnicoOptionsList';
import type { Usuario } from '@/mocks/usuariosMock';
import { useThemeColors } from '@/state/themeStore';

type Props = {
  visible: boolean;
  incidenciaId: string;
  tecnicoActualId?: string;
  onClose: () => void;
  onReasignado: () => void;
};

/** Overlay - Seleccionar Responsable (Spec 07, RF-07.8 a RF-07.10). Sin filtro por
 * sector (decisión confirmada con Edgar): siempre muestra el pool completo. */
export function SeleccionarResponsableSheet({ visible, incidenciaId, tecnicoActualId, onClose, onReasignado }: Props) {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const reasignar = useReasignarResponsable();

  const handleSelect = (usuario: Usuario) => {
    reasignar.mutate(
      { id: incidenciaId, usuario },
      {
        onSuccess: () => {
          onReasignado();
          onClose();
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card}>
          <Text style={styles.title}>Reasignar responsable</Text>
          <TecnicoOptionsList selectedId={tecnicoActualId} onSelect={handleSelect} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(13, 43, 82, 0.25)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: 300,
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.xs,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    title: { fontSize: 13, fontWeight: '700', color: t.primaryDark, marginBottom: Spacing.xs },
  });
}
