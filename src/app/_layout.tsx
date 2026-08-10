import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/auth/AuthContext';
import { PhoneFrame } from '@/components/PhoneFrame';
import { ToastProvider } from '@/components/shared/Toast';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <PhoneFrame>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(app)" />
                <Stack.Screen name="incidencia/[id]" options={{ presentation: 'modal' }} />
              </Stack>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </PhoneFrame>
  );
}
