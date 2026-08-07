import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

/**
 * Stub móvil — el dashboard operativo se optimizó para navegador (ver index.web.tsx).
 * En dispositivos nativos se muestra este mensaje mientras no exista una versión
 * móvil equivalente. Expo Router elige automáticamente index.web.tsx en web.
 */
export default function DashboardMobileStub() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Ionicons
          name="desktop-outline"
          size={48}
          color={Colors.textMuted}
          style={{ marginBottom: Spacing.md }}
        />
        <Text style={styles.title}>Dashboard disponible en escritorio</Text>
        <Text style={styles.subtitle}>
          El panel de análisis operativo está optimizado para navegador web.
          Abrí GOTA desde una computadora para acceder a los mapas, gráficos y KPIs.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textBody,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
