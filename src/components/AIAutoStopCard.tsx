import React, { } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';
import type { AIPrediction } from '@/hooks/useAIPrediction';

interface AIAutoStopCardProps {
  aiPrediction: AIPrediction | null;
  aiLoading: boolean;
  aiAutoStopped: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  MAINTAIN:      'Maintaining optimal settings',
  REDUCE_TEMP:   'Reducing temperature (-5°C)',
  INCREASE_TEMP: 'Increasing temperature (+5°C)',
  INCREASE_FAN:  'Increasing fan speed (+15%)',
  STOP:          'Stopping dryer',
};

const ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  MAINTAIN:      'checkmark-circle-outline',
  REDUCE_TEMP:   'thermometer-outline',
  INCREASE_TEMP: 'flame-outline',
  INCREASE_FAN:  'speedometer-outline',
  STOP:          'stop-circle-outline',
};

function formatETA(minutes: number): string {
  if (!isFinite(minutes) || minutes <= 0) return 'Done';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AIAutoStopCard({ aiPrediction, aiLoading, aiAutoStopped }: AIAutoStopCardProps) {
  if (aiAutoStopped) {
    return (
      <View style={[styles.card, styles.cardStopped]}>
        <View style={styles.header}>
          <View style={[styles.badge, styles.badgeDone]}>
            <Ionicons name="checkmark" size={13} color="#fff" />
          </View>
          <Text style={[styles.cardTitle, { color: COLORS.primaryDark }]}>Drying Complete</Text>
        </View>
        <Text style={styles.subtext}>AI auto-stopped the dryer — target moisture reached</Text>
      </View>
    );
  }

  const action = aiPrediction?.action ?? 'MAINTAIN';
  const recType = aiPrediction?.recommendationType ?? 'optimal';
  const accentColor = recType === 'critical' ? '#DC2626' : recType === 'warning' ? '#D97706' : COLORS.primaryDark;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          {aiLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="sparkles" size={13} color="#fff" />}
        </View>
        <Text style={styles.cardTitle}>AI Auto Control</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Current action */}
      <View style={styles.actionRow}>
        <Ionicons name={ACTION_ICONS[action] ?? 'settings-outline'} size={15} color={accentColor} />
        <Text style={[styles.actionText, { color: accentColor }]}>
          {ACTION_LABELS[action] ?? 'Analyzing conditions'}
        </Text>
      </View>

      {/* Recommendation text */}
      {aiPrediction && (
        <Text style={styles.recText}>{aiPrediction.recommendation}</Text>
      )}

      {/* Stats row */}
      {aiPrediction && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValue}>{formatETA(aiPrediction.estimatedMinutesToTarget)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pred. 30m</Text>
            <Text style={styles.statValue}>{aiPrediction.predictedMoisture30min}%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Confidence</Text>
            <Text style={[styles.statValue, { color: aiPrediction.confidence >= 80 ? COLORS.primaryDark : '#D97706' }]}>
              {aiPrediction.confidence}%
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Efficiency</Text>
            <Text style={[styles.statValue, { color: aiPrediction.efficiencyScore >= 70 ? COLORS.primaryDark : '#D97706' }]}>
              {aiPrediction.efficiencyScore}%
            </Text>
          </View>
        </View>
      )}

      {!aiPrediction && !aiLoading && (
        <Text style={styles.subtext}>Waiting for sensor data...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    gap: 10,
  },
  cardStopped: {
    backgroundColor: '#DCFCE7',
    borderColor: COLORS.primaryDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: {
    backgroundColor: COLORS.primaryDark,
  },
  cardTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: COLORS.primaryDark,
    flex: 1,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#D1FAE5',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
  },
  recText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#A7F3D0',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  subtext: {
    ...IOS_TYPOGRAPHY.caption1,
    color: COLORS.textSecondary,
  },
});
