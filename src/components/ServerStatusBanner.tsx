import React, { useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, AppStateStatus } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { grainApi } from '@/api';
import { useAppContext } from '@/context/AppContext';
import type { ServerStatus } from '@/context/AppContext';
import { IOS_TYPOGRAPHY } from '@/utils/constants';

const PING_INTERVAL = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

async function pingWithBackoff(): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ok = await grainApi.health.ping();
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

interface ServerStatusBannerProps {
  variant?: 'reconnecting' | 'offline' | 'error';
}

const STATUS_CONFIG: Record<Exclude<ServerStatus, 'online'>, { bgColor: string; icon: string; message: string }> = {
  offline: {
    bgColor: '#EF4444',
    icon: 'wifi-outline',
    message: 'No internet connection — Check your network',
  },
  unreachable: {
    bgColor: '#f59e0b',
    icon: 'cloud-offline-outline',
    message: 'Server sleeping — waiting to wake up',
  },
  reconnecting: {
    bgColor: '#F97316',
    icon: 'cloud-download-outline',
    message: 'Reconnecting to server…',
  },
};

export default function ServerStatusBanner(_props: ServerStatusBannerProps) {
  const { serverStatus, checkServerHealth } = useAppContext();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ping = useCallback(async () => {
    await checkServerHealth();
  }, [checkServerHealth]);

  useEffect(() => {
    if (serverStatus !== 'online') {
      ping();
      intervalRef.current = setInterval(ping, PING_INTERVAL);
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && serverStatus !== 'online') {
        ping();
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, [ping, serverStatus]);

  if (serverStatus === 'online') return null;

  const config = STATUS_CONFIG[serverStatus];

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <View style={[styles.banner, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon as any} size={18} color="#FFFFFF" />
        <Text style={styles.message}>{config.message}</Text>
        {serverStatus !== 'reconnecting' && (
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
