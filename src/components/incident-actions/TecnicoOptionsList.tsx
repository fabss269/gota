import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { USUARIOS, type Usuario } from '@/mocks/usuariosMock';

const ROL_LABEL: Record<Usuario['rol'], string> = {
  tecnico: 'Técnico',
  supervisor: 'Supervisora',
};

type Props = {
  selectedId?: string;
  onSelect: (usuario: Usuario) => void;
};

/**
 * Lista de técnicos/supervisores para reasignar (Spec 07, RF-07.8 a RF-07.10) —
 * compartida entre `SeleccionarResponsableSheet` (reasignación directa desde el header
 * del detalle) y `RegistrarAvanceSheet` (motivo "Reasignar técnico"), para que ambos
 * flujos usen el mismo componente en vez de duplicar el listado.
 */
export function TecnicoOptionsList({ selectedId, onSelect }: Props) {
  return (
    <>
      {USUARIOS.map((usuario) => {
        const initials = usuario.nombre
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0])
          .join('');
        const isSelected = usuario.id === selectedId;
        return (
          <Pressable
            key={usuario.id}
            style={[styles.row, isSelected && styles.rowSelected]}
            onPress={() => onSelect(usuario)}
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
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.xs,
  },
  rowSelected: { backgroundColor: '#E0E4FF' },
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
