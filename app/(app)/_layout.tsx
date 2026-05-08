import { Stack, Redirect, usePathname } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View } from 'react-native';
import { ServerStatusBanner, ErrorBoundary, Navigation, AssistantFAB, AssistantModal } from '@/components';
import { LoadingScreen } from '@/components/LoadingScreen';

// Screens that should NOT show the bottom nav bar or FAB
const NO_NAV_PATHS = ['/device/', '/add-device'];

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  const showNav = !NO_NAV_PATHS.some(p => pathname.includes(p));

  return (
    <View style={{ flex: 1 }}>
      <ServerStatusBanner />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="control" />
          <Stack.Screen name="ai-prediction" />
          <Stack.Screen name="ai-chatbot" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="alerts" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="device/[id]" />
          <Stack.Screen name="add-device" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ErrorBoundary>
      {showNav && <Navigation />}
      {showNav && <AssistantFAB />}
      <AssistantModal />
    </View>
  );
}
