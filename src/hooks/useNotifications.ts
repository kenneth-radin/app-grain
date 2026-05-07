import { useState, useEffect, useCallback } from 'react';
import { grainApi, isNetworkError } from '@/api';
import type { NotificationItem } from '@/api';

interface UseNotificationsReturn {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markAsRead: (ids?: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await grainApi.notifications.list({ limit: 30 });
      setNotifications(result.data);
      setUnreadCount(result.data.filter(n => !n.isRead).length);
    } catch (err) {
      if (!isNetworkError(err)) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll for new notifications every 20s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await grainApi.notifications.list({ limit: 30 });
        setNotifications(result.data);
        setUnreadCount(result.data.filter(n => !n.isRead).length);
      } catch { /* silent */ }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = useCallback(async (ids?: string[]) => {
    try {
      const result = await grainApi.notifications.markRead(ids);
      setUnreadCount(result.unreadCount);
      setNotifications(prev =>
        prev.map(n => (ids ? ids.includes(n._id) : true) ? { ...n, isRead: true } : n)
      );
    } catch { /* silent */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const result = await grainApi.notifications.markRead();
      setUnreadCount(result.unreadCount);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* silent */ }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
