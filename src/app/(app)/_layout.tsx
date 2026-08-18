import { Redirect, Slot } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Colors } from '@/constants/theme';
import { DrawerContent } from '@/navigation/DrawerContent';
import { TopNav } from '@/navigation/TopNav';

/** Ancho a partir del cual se usa el TopNav horizontal en lugar del Drawer lateral. */
const WIDE_BREAKPOINT = 900;

/** Contenedor autenticado de la app: Mapa / Dashboard / Incidencias (Spec 08).
 *  Responsive: TopNav horizontal en pantallas anchas (>= 900px), Drawer en angostas. */
export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { width } = useWindowDimensions();

  if (isLoading) return <View style={{ flex: 1, backgroundColor: Colors.primary }} />;
  if (!isAuthenticated) return <Redirect href="/login" />;

  if (width >= WIDE_BREAKPOINT) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <TopNav />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: Colors.accent,
      }}
    >
      <Drawer.Screen name="mapa/index" options={{ drawerLabel: 'Mapa' }} />
      <Drawer.Screen name="dashboard/index" options={{ drawerLabel: 'Dashboard' }} />
      {/* Incidencias sigue accesible por URL /incidencias, pero se oculta del drawer. */}
      <Drawer.Screen name="incidencias/index" options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
