import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';

interface CommandStatusBannerProps {
  commandAck: boolean;
  commandTimeout: boolean;
  syncingUntil: number | null;
  isServerOnline: boolean;
  queuedCommandCount: number;
}

export function CommandStatusBanner({
  commandAck,
  commandTimeout,
  syncingUntil,
  isServerOnline,
  queuedCommandCount,
}: CommandStatusBannerProps) {
  return (
    <>
      {/* Command Acknowledgement Banner */}
      {commandAck ? (
        <View style={styles.syncBanner}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
          <Text style={styles.syncBannerText}>Command received by device</Text>
        </View>
      ) : commandTimeout ? (
        <View style={[styles.syncBanner, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={[styles.syncBannerText, { color: COLORS.danger }]}>Device not responding</Text>
        </View>
      ) : syncingUntil !== null && Date.now() < syncingUntil ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.syncBannerText}>Syncing with device...</Text>
        </View>
      ) : null}

      {/* Offline / Queued Command Banner */}
      {!isServerOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={COLORS.orange} />
          <Text style={styles.offlineBannerText}>
            Offline{queuedCommandCount > 0 ? ` — ${queuedCommandCount} command${queuedCommandCount > 1 ? 's' : ''} queued` : ' — commands will be queued'}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  syncBannerText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: COLORS.primary,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  offlineBannerText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: COLORS.orange,
    fontWeight: '600',
  },
});
