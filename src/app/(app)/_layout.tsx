import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Colors } from '@/constants/theme';
import { DrawerContent } from '@/navigation/DrawerContent';

/** Contenedor autenticado de la app: Mapa / Dashboard / Incidencias (Spec 08). */
export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <View style={{ flex: 1, backgroundColor: Colors.primary }} />;
  if (!isAuthenticated) return <Redirect href="/login" />;

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
      <Drawer.Screen name="incidencias/index" options={{ drawerLabel: 'Incidencias' }} />
    </Drawer>
  );
}
