import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!user || user.role !== 'admin') {
    return <Redirect href="/(app)/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="devices" />
      <Stack.Screen name="users" />
    </Stack>
  );
}
