import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View } from 'react-native';
import { ServerStatusBanner, ErrorBoundary } from '@/components';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function AppLayout() {
  const { isAuthenticated, isLoading, isReconnecting } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1 }}>
      <ServerStatusBanner variant={isReconnecting ? 'reconnecting' : 'offline'} />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="control" />
          <Stack.Screen name="ai-prediction" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="alerts" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="device/[id]" />
          <Stack.Screen name="add-device" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ErrorBoundary>
    </View>
  );
}
