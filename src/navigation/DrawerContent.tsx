import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Colors, Radius, Spacing } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/mapa', label: 'Mapa', icon: 'location-outline' },
  { href: '/dashboard', label: 'Dashboard', icon: 'stats-chart-outline' },
];

/**
 * nav-drawer (Spec 08). Corrección de diseño aplicada: se eliminan los 3 ítems de
 * relleno "Subtitle 1" y el usuario hardcodeado del board original; el nombre/rol se
 * lee de la sesión autenticada. El ícono de "Incidencias" se cambia de un corazón
 * (sin relación semántica) a una alerta.
 */
export function DrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user?.nombre)}</Text>
        </View>
        <Text style={styles.name}>{user?.nombre ?? 'Usuario'}</Text>
        <Text style={styles.role}>{user?.rol ?? ''}</Text>
      </View>

      <View style={styles.divider} />

      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Pressable
            key={item.href}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => router.push(item.href as never)}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={active ? Colors.accent : Colors.textBody}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}

      <View style={styles.spacer} />

      <Pressable
        style={styles.item}
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.textBody} style={styles.itemIcon} />
        <Text style={styles.itemLabel}>Cerrar sesión</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

function initials(nombre?: string) {
  if (!nombre) return '?';
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  header: { alignItems: 'flex-start', marginBottom: Spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { color: Colors.white, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: Colors.textBody },
  role: { fontSize: 13, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  itemActive: { backgroundColor: '#EEF1F6' },
  itemIcon: { width: 22, textAlign: 'center' },
  itemLabel: { fontSize: 15, fontWeight: '600', color: Colors.textBody },
  itemLabelActive: { color: Colors.accent },
  spacer: { flex: 1, minHeight: Spacing.lg },
});
