import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';
import type { AIPrediction } from '@/hooks/useAIPrediction';

interface AIAutoStopCardProps {
  aiPrediction: AIPrediction | null;
  aiLoading: boolean;
  aiAutoStopped: boolean;
}

export function AIAutoStopCard({ aiPrediction, aiLoading, aiAutoStopped }: AIAutoStopCardProps) {
  return (
    <View style={styles.aiCard}>
      <View style={styles.aiCardHeader}>
        <View style={styles.aiActiveBadge}>
          <Ionicons name="sparkles" size={14} color={COLORS.white} />
        </View>
        <Text style={styles.aiCardTitle}>AI is controlling the dryer</Text>
      </View>
      <Text style={styles.aiCardSubtext}>AI automatically adjusts fan speed and temperature for optimal drying</Text>
      {aiPrediction && (
        <>
          <View style={styles.aiRecRow}>
            <Ionicons
              name={aiPrediction.recommendationType === 'optimal' ? 'checkmark-circle' : aiPrediction.recommendationType === 'warning' ? 'warning' : 'alert-circle'}
              size={16}
              color={aiPrediction.recommendationType === 'optimal' ? COLORS.primary : aiPrediction.recommendationType === 'warning' ? COLORS.warning : COLORS.danger}
            />
            <Text style={[styles.aiRecText, { color: aiPrediction.recommendationType === 'optimal' ? COLORS.primaryDark : aiPrediction.recommendationType === 'warning' ? '#D97706' : '#DC2626' }]}>
              {aiPrediction.recommendation}
            </Text>
          </View>
          {!aiPrediction.isDryingComplete && (
            <Text style={styles.aiEstText}>
              Est. completion: {Math.floor(aiPrediction.estimatedMinutesToTarget / 60)}h {aiPrediction.estimatedMinutesToTarget % 60}m
            </Text>
          )}
        </>
      )}
      {aiLoading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 4 }} />}
      {aiAutoStopped && (
        <View style={styles.aiStoppedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
          <Text style={styles.aiStoppedText}>Auto-stopped by AI — target moisture reached</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aiCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    gap: 6,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiActiveBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCardTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: COLORS.primaryDark,
  },
  aiCardSubtext: {
    ...IOS_TYPOGRAPHY.footnote,
    color: COLORS.textSecondary,
  },
  aiRecRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  aiRecText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '500',
    flex: 1,
  },
  aiEstText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  aiStoppedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 4,
  },
  aiStoppedText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
});
