import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GotaIcon } from '@/icons/GotaIcon';
import { getStoredSession, isSessionExpired } from '@/auth/session';
import { Colors, Spacing } from '@/constants/theme';

const MIN_MS = 900;
const MAX_MS = 3000;

/** Splash / Loader (Spec 01). */
export default function LoaderScreen() {
  const router = useRouter();
  const navigated = useRef(false);

  useEffect(() => {
    const start = Date.now();

    const decide = async () => {
      let target: '/(app)/mapa' | '/login' = '/login';
      try {
        const session = await Promise.race([
          getStoredSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), MAX_MS)),
        ]);
        if (session && !isSessionExpired(session)) {
          target = '/(app)/mapa';
        }
      } catch {
        target = '/login';
      }

      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_MS - elapsed);
      setTimeout(() => {
        if (navigated.current) return;
        navigated.current = true;
        router.replace(target);
      }, remaining);
    };

    decide();
  }, [router]);

  return (
    <LinearGradient colors={[Colors.primary, '#153C74']} style={styles.container}>
      <View style={styles.logoCircle}>
        <GotaIcon size={40} color={Colors.primary} />
      </View>
      <Text style={styles.title}>GOTA</Text>
      <Text style={styles.subtitle}>
        Gestión Operacional, Trazabilidad{'\n'}y Atención de incidencias
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.white,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
