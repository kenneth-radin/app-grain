import { Platform } from 'react-native';
import type { DryingAlert } from './dryingAlerts';
import { getNotificationsClient } from './notificationsClient';

/**
 * Schedule a local push notification for a drying alert.
 * Uses Expo's local notification API so it works without a backend push service.
 */
export async function triggerDryingAlertNotification(
  alert: DryingAlert,
  deviceId?: string,
): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;

  const Notifications = getNotificationsClient();
  // expo-notifications is not loaded in Expo Go on Android (SDK 53+) — skip quietly.
  if (!Notifications) return undefined;

  // Only notify for non-normal alerts
  if (alert.type === 'normal') return undefined;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.type === 'overheating'
          ? '🌡️ Overheating Warning'
          : '💧 High Humidity Warning',
        body: alert.message,
        data: {
          deviceId,
          screen: 'alerts',
          alertType: alert.type,
          severity: alert.severity,
        },
        sound: alert.severity === 'critical' ? 'default' : false,
      },
      trigger: null, // immediate
    });
    return id;
  } catch (err) {
    console.warn('[triggerDryingAlertNotification] Failed:', err);
    return undefined;
  }
}
