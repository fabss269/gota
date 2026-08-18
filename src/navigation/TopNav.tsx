import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { ThemeToggleButton } from '@/components/map/ThemeToggleButton';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/state/themeStore';

type IconName = keyof typeof Ionicons.glyphMap;

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/mapa', label: 'Mapa', icon: 'location-outline' },
  { href: '/dashboard', label: 'Dashboard', icon: 'stats-chart-outline' },
];

/**
 * Barra de navegación horizontal (vista ancha ≥ 900px). Reemplaza al Drawer con:
 * marca a la izquierda, links centrados con estado activo, y perfil con menú
 * desplegable a la derecha ("Cerrar sesión"). Colores del theme via
 * useThemeColors() para que el bar completo siga el toggle claro/oscuro.
 */
export function TopNav() {
  const c = useThemeColors();
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
    <View style={[styles.bar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <Image
        source={require('@/assets/images/epsel/epsel-logo.png')}
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
              style={[styles.link, active && { backgroundColor: c.accentBg }]}
              onPress={() => router.push(item.href as never)}
            >
              <Ionicons name={item.icon} size={18} color={active ? c.accent : c.textBody} />
              <Text style={[styles.linkLabel, { color: active ? c.accent : c.textBody }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rightGroup}>
        <ThemeToggleButton />
        <Pressable style={styles.profile} onPress={() => setMenuOpen(true)}>
          <View style={[styles.avatar, { backgroundColor: c.primary }]}>
            <Text style={[styles.avatarText, { color: c.white }]}>{initials(user?.nombre)}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={[styles.name, { color: c.textBody }]} numberOfLines={1}>
              {user?.nombre ?? 'Usuario'}
            </Text>
            <Text style={[styles.role, { color: c.textMuted }]} numberOfLines={1}>
              {user?.rol ?? ''}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={c.textMuted} />
        </Pressable>
      </View>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Pressable style={styles.menuItem} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color={c.textBody} />
                <Text style={[styles.menuItemLabel, { color: c.textBody }]}>Cerrar sesión</Text>
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
    borderBottomWidth: 1,
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
  linkLabel: { fontSize: 14, fontWeight: '600' },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 13 },
  name: { fontSize: 13, fontWeight: '700' },
  role: { fontSize: 11 },
  overlay: { flex: 1, backgroundColor: 'transparent' },
  menu: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    minWidth: 200,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
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
  menuItemLabel: { fontSize: 14, fontWeight: '600' },
});
