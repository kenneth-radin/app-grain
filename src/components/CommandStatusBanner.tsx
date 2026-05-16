import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';

interface CommandStatusBannerProps {
  commandAck: boolean;
  commandTimeout: boolean;
  syncingUntil: number | null;
  commandStatus?: 'idle' | 'pending' | 'polled' | 'executing' | 'executed' | 'failed' | 'timeout' | 'error';
  isServerOnline: boolean;
  queuedCommandCount: number;
}

export function CommandStatusBanner({
  commandAck,
  commandTimeout,
  syncingUntil,
  commandStatus,
  isServerOnline,
  queuedCommandCount,
}: CommandStatusBannerProps) {
  const isSending = syncingUntil !== null && Date.now() < syncingUntil;
  const isSentToDevice = isSending && (commandStatus === 'polled' || commandStatus === 'executing');

  return (
    <>
      {/* Command Acknowledgement Banner */}
      {commandAck ? (
        <View style={styles.syncBanner}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
          <Text style={styles.syncBannerText}>Confirmed</Text>
        </View>
      ) : commandTimeout ? (
        <View style={[styles.syncBanner, styles.timeoutBanner]}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={[styles.syncBannerText, { color: COLORS.danger }]}>Timeout — retry?</Text>
        </View>
      ) : isSentToDevice ? (
        <View style={styles.syncBanner}>
          <Ionicons name="radio-outline" size={18} color={COLORS.primary} />
          <Text style={styles.syncBannerText}>Sent to device</Text>
        </View>
      ) : isSending ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.syncBannerText}>Sending...</Text>
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
  timeoutBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
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
