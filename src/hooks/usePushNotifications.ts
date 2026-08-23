import { useEffect, useRef, useCallback } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { grainApi } from '@/api';
import { useRouter } from 'expo-router';
import { Routes } from '@/types/navigation';
import {
  getNotificationsClient,
} from '@/utils/notificationsClient';

// Configure how notifications appear when the app is foregrounded.
// Skipped entirely in Expo Go on Android, where expo-notifications must not load.
const Notifications = getNotificationsClient();
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function usePushNotifications() {
  const pushTokenRef = useRef<string | null>(null);
  const router = useRouter();

  // Register for push notifications and send token to backend
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    const Notifications = getNotificationsClient();
    if (!Notifications) {
      console.warn(
        '[usePushNotifications] Notifications unavailable in Expo Go on Android (SDK 53+) — skipping registration.',
      );
      return null;
    }

    if (Platform.OS === 'web') return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[usePushNotifications] Push notification permission denied');
      return null;
    }

    // Android-specific channel setup (needed for local + remote notifications)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
      });
    }

    // Remote push tokens require a development build with an EAS project ID.
    // In Expo Go (and without extra.eas.projectId) getExpoPushTokenAsync() throws
    // "projectId is required" — skip it cleanly and keep local notifications working.
    const isExpoGo =
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as
      | string
      | undefined;

    if (isExpoGo || !projectId) {
      console.warn(
        '[usePushNotifications] Remote push unavailable in Expo Go or without an EAS projectId — skipping token registration. Local notifications remain enabled.',
      );
      return null;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      pushTokenRef.current = token;

      // Send token to backend
      try {
        await grainApi.push.registerToken(token);
      } catch (err) {
        console.warn('[usePushNotifications] Failed to register token with backend:', err);
      }

      return token;
    } catch (err) {
      console.warn('[usePushNotifications] Failed to get push token:', err);
      return null;
    }
  }, []);

  // Listen for incoming notifications (foreground banner only — no action needed)
  useEffect(() => {
    const Notifications = getNotificationsClient();
    if (!Notifications) return;

    const subscription = Notifications.addNotificationReceivedListener(() => {});
    return () => subscription.remove();
  }, []);

  // Listen for notification taps (when app is in background or killed)
  useEffect(() => {
    const Notifications = getNotificationsClient();
    if (!Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      // Navigate based on notification data
      if (data?.type === 'drying_complete' || data?.type === 'session_started') {
        router.push('/(app)/sessions' as any);
      } else if (data?.deviceId) {
        router.push(`/(app)/device/${data.deviceId}` as const);
      } else if (data?.screen === 'alerts') {
        router.push(Routes.Alerts);
      }
    });

    return () => subscription.remove();
  }, [router]);

  return {
    pushToken: pushTokenRef.current,
    registerForPushNotifications,
  };
}
