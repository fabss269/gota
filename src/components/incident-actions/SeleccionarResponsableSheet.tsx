import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useReasignarResponsable } from '@/hooks/useReasignarResponsable';
import { USUARIOS, type Usuario } from '@/mocks/usuariosMock';

const ROL_LABEL: Record<Usuario['rol'], string> = {
  tecnico: 'Técnico',
  supervisor: 'Supervisora',
};

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
          {USUARIOS.map((usuario) => {
            const initials = usuario.nombre
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('');
            const isCurrent = usuario.id === tecnicoActualId;
            return (
              <Pressable
                key={usuario.id}
                style={[styles.row, isCurrent && styles.rowCurrent]}
                onPress={() => handleSelect(usuario)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>{initials}</Text>
                </View>
                <View style={styles.userCol}>
                  <Text style={styles.userName}>{usuario.nombre}</Text>
                  <Text style={styles.userRole}>
                    {ROL_LABEL[usuario.rol]} · {usuario.cuadrilla ?? usuario.sector}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 43, 82, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 300,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark, marginBottom: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.xs,
  },
  rowCurrent: { backgroundColor: '#E0E4FF' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { fontSize: 11, fontWeight: '700', color: Colors.white },
  userCol: { gap: 1 },
  userName: { fontSize: 12, fontWeight: '600', color: Colors.textBody },
  userRole: { fontSize: 10, color: Colors.textMuted },
});
