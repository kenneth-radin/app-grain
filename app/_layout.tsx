import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { StatusBar } from 'expo-status-bar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toast } from '@/components';
import { validateEnv } from '@/lib/validateEnv';

validateEnv();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="(auth)" options={{ animation: 'fade_from_bottom' }} />
            <Stack.Screen name="(app)" />
          </Stack>
          <Toast />
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
