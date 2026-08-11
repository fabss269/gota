import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useThemeColors, useThemeStore } from '@/state/themeStore';

/** Switch manual de modo oscuro para las pantallas de Mapa (desktop) — pedido de
 *  Edgar 2026-08-05, alcance acotado a Mapa (ver useThemeStore). Vive en el
 *  TopNav al lado del perfil de usuario. */
export function ThemeToggleButton() {
  const c = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = mode === 'dark';

  return (
    <Pressable
      style={styles.btn}
      onPress={toggle}
      accessibilityLabel={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
    >
      <Ionicons
        name={isDark ? 'sunny-outline' : 'moon-outline'}
        size={18}
        color={c.textBody}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
