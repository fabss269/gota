import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Colors, Radius, Spacing } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/mapa', label: 'Mapa', icon: 'location-outline' },
  { href: '/dashboard', label: 'Dashboard', icon: 'stats-chart-outline' },
  { href: '/incidencias', label: 'Incidencias', icon: 'warning-outline' },
];

/**
 * Barra de navegación horizontal (vista ancha ≥ 900px). Reemplaza al Drawer con:
 * marca a la izquierda, links centrados con estado activo, y perfil con menú
 * desplegable a la derecha ("Cerrar sesión").
 */
export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.bar}>
      <Image
        source={require('@/assets/images/epsel-logo.png')}
        style={styles.brandLogo}
        resizeMode="contain"
        accessibilityLabel="EPSEL"
      />

      <View style={styles.links}>
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Pressable
              key={item.href}
              style={[styles.link, active && styles.linkActive]}
              onPress={() => router.push(item.href as never)}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={active ? Colors.accent : Colors.textBody}
              />
              <Text style={[styles.linkLabel, active && styles.linkLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.profile} onPress={() => setMenuOpen(true)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user?.nombre)}</Text>
        </View>
        <View style={styles.profileMeta}>
          <Text style={styles.name} numberOfLines={1}>{user?.nombre ?? 'Usuario'}</Text>
          <Text style={styles.role} numberOfLines={1}>{user?.rol ?? ''}</Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </Pressable>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={styles.overlay}>
            <View style={styles.menu}>
              <Pressable style={styles.menuItem} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color={Colors.textBody} />
                <Text style={styles.menuItemLabel}>Cerrar sesión</Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function initials(nombre?: string) {
  if (!nombre) return '?';
  return nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

const styles = StyleSheet.create({
  bar: {
    height: 64,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  brandLogo: { width: 58, height: 40 },
  links: { flex: 1, flexDirection: 'row', gap: Spacing.xs },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  linkActive: { backgroundColor: '#EEF1F6' },
  linkLabel: { fontSize: 14, fontWeight: '600', color: Colors.textBody },
  linkLabelActive: { color: Colors.accent },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  profileMeta: { maxWidth: 180 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  name: { fontSize: 13, fontWeight: '700', color: Colors.textBody },
  role: { fontSize: 11, color: Colors.textMuted },
  overlay: { flex: 1, backgroundColor: 'transparent' },
  menu: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    minWidth: 200,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  menuItemLabel: { fontSize: 14, color: Colors.textBody, fontWeight: '600' },
});
