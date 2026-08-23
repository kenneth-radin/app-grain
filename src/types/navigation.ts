import type { RelativePathString } from 'expo-router';

// Typed route params for routes that accept parameters.
// With typedRoutes enabled, expo-router auto-generates route types from app/ directory.
// This file provides explicit param types for programmatic navigation.

export interface DeviceDetailParams {
  id: string;
}

export interface ControlParams {
  deviceId: string;
}

// Typed route strings — use these instead of raw strings with `as any`
export const Routes = {
  // Auth
  Login: '/(auth)/login' as RelativePathString,
  Signup: '/(auth)/signup' as RelativePathString,

  // App
  Dashboard: '/(app)/dashboard' as RelativePathString,
  Control: '/(app)/control' as RelativePathString,
  Sessions: '/(app)/sessions' as RelativePathString,
  Analytics: '/(app)/analytics' as RelativePathString,
  Alerts: '/(app)/alerts' as RelativePathString,
  Settings: '/(app)/settings' as RelativePathString,
  Profile: '/(app)/profile' as RelativePathString,
  AddDevice: '/(app)/add-device' as RelativePathString,
  AIChatbot: '/(app)/ai-chatbot' as RelativePathString,

  // Dynamic routes — use router.push with params object
  DeviceDetail: '/(app)/device/[id]' as const,
} as const;
