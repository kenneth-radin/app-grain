import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { grainApi } from '@/api';
import { useRouter } from 'expo-router';
import { Routes } from '@/types/navigation';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const pushTokenRef = useRef<string | null>(null);
  const router = useRouter();

  // Register for push notifications and send token to backend
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
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

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      pushTokenRef.current = token;

      // Send token to backend
      try {
        await grainApi.push.registerToken(token);
        console.log('[usePushNotifications] Push token registered:', token);
      } catch (err) {
        console.warn('[usePushNotifications] Failed to register token with backend:', err);
      }

      // Android-specific channel setup
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#22C55E',
        });
      }

      return token;
    } catch (err) {
      console.warn('[usePushNotifications] Failed to get push token:', err);
      return null;
    }
  }, []);

  // Listen for incoming notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      console.log('[usePushNotifications] Notification received:', data);
    });

    return () => subscription.remove();
  }, []);

  // Listen for notification taps (when app is in background or killed)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      // Navigate based on notification data
      if (data?.deviceId) {
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
