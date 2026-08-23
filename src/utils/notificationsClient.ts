import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';

/**
 * Lazily-loaded expo-notifications client.
 *
 * On Android, Expo Go (SDK 53+) removed ALL remote push support from
 * expo-notifications, and the library prints a red console warning as soon as
 * its JS module is imported — even if no push API is ever called. To keep the
 * console clean we simply never load the module inside Expo Go on Android.
 *
 * Everywhere else (iOS Expo Go, development builds, production builds) the
 * library loads normally with full functionality.
 */

export type NotificationsClient = typeof NotificationsType;

let cachedClient: NotificationsClient | null | undefined;

export function getNotificationsClient(): NotificationsClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const isExpoGoAndroid =
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (isExpoGoAndroid) {
    // Skip loading expo-notifications entirely to avoid the SDK 53+ warning.
    cachedClient = null;
  } else {
    // Lazy require so the module body never executes on Android/Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedClient = require('expo-notifications') as NotificationsClient;
  }

  return cachedClient;
}
