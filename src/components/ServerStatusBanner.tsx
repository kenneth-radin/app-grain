import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, AppStateStatus } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { grainApi } from '@/api';
import { useAppContext } from '@/context/AppContext';
import { IOS_TYPOGRAPHY } from '@/utils/constants';

const HEALTH_CHECK_INTERVAL = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // exponential backoff for Render cold starts

async function healthCheckWithBackoff(): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ok = await grainApi.health.check();
      if (ok) return true;
    } catch {
      // network error, retry
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  return false;
}

type BannerVariant = 'reconnecting' | 'offline' | 'error';

interface ServerStatusBannerProps {
  variant: BannerVariant;
}

export default function ServerStatusBanner({ variant }: ServerStatusBannerProps) {
  const { isServerOnline, checkServerHealth } = useAppContext();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const ping = useCallback(async () => {
    setIsRetrying(true);
    const ok = await healthCheckWithBackoff();
    if (ok) {
      setRetryCount(0);
    } else {
      setRetryCount((c) => Math.min(c + 1, MAX_RETRIES));
    }
    await checkServerHealth();
    setIsRetrying(false);
  }, [checkServerHealth]);

  useEffect(() => {
    ping();
    intervalRef.current = setInterval(ping, HEALTH_CHECK_INTERVAL);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        ping();
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, [ping]);

  // Determine visual state
  const isReconnecting = variant === 'reconnecting' || isRetrying;
  const isFailed = retryCount >= MAX_RETRIES && !isRetrying;

  if (isServerOnline && !isReconnecting) return null;

  // Color: amber (reconnecting), orange (retrying), red (failed after 3 retries)
  const bgColor = isFailed
    ? '#EF4444'
    : isReconnecting
      ? '#F97316'
      : '#f59e0b';

  const icon = isRetrying
    ? 'cloud-download-outline'
    : isFailed
      ? 'cloud-offline-outline'
      : 'cloud-download-outline';

  const message = isRetrying
    ? 'Reconnecting to server…'
    : isFailed
      ? 'Cannot connect to server — Check your connection'
      : 'Reconnecting to server...';

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <View style={[styles.banner, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={18} color="#FFFFFF" />
        <Text style={styles.message}>{message}</Text>
        {!isRetrying && (
          <TouchableOpacity onPress={ping} style={styles.retryButton} activeOpacity={0.7}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  message: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 50,
  },
  retryText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
