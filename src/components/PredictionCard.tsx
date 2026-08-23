import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Prediction, PredictionRecommendation, PredictionStatus } from '@/api';
import { IOS_TYPOGRAPHY } from '@/utils/constants';

interface PredictionCardProps {
  prediction: Prediction | null;
}

const RECOMMENDATION_META: Record<
  PredictionRecommendation,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  CONTINUE_DRYING: { label: 'Continue drying', color: '#16A34A', bg: '#DCFCE7', icon: 'play-circle-outline' },
  REDUCE_HEATING: { label: 'Reduce heating', color: '#D97706', bg: '#FEF3C7', icon: 'flame-outline' },
  INCREASE_AIRFLOW: { label: 'Increase airflow', color: '#2563EB', bg: '#DBEAFE', icon: 'leaf-outline' },
  APPROACHING_COMPLETION: { label: 'Approaching completion', color: '#7C3AED', bg: '#EDE9FE', icon: 'hourglass-outline' },
  ESTIMATED_COMPLETE: { label: 'Estimated complete', color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle-outline' },
};

const STATUS_LABEL: Record<PredictionStatus, string> = {
  in_progress: 'Drying in progress',
  approaching_completion: 'Almost done',
  estimated_complete: 'Target reached',
};

function formatRemaining(minutes: number): string {
  if (minutes <= 0) return 'Now';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** AI drying-time prediction card fed by the backend's /api/predictions endpoint. */
export default function PredictionCard({ prediction }: PredictionCardProps) {
  if (!prediction) return null;

  const meta = RECOMMENDATION_META[prediction.recommendation];
  const eta = new Date(prediction.estimatedCompletionAt);
  const isComplete = prediction.status === 'estimated_complete';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={14} color="#16A34A" />
        <Text style={styles.headerText}>AI PREDICTION</Text>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceText}>
            {prediction.source === 'ml_model' ? `ML ${prediction.modelVersion ?? ''}` : 'ESTIMATED'}
          </Text>
        </View>
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.mainCol}>
          <Text style={styles.remainingVal}>{isComplete ? 'Complete' : formatRemaining(prediction.remainingMinutes)}</Text>
          <Text style={styles.remainingLbl}>{isComplete ? 'target condition reached' : 'estimated time remaining'}</Text>
        </View>
        <View style={[styles.recoChip, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={16} color={meta.color} />
          <Text style={[styles.recoText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {STATUS_LABEL[prediction.status]} · ETA {eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.footerSub}>elapsed {Math.round(prediction.elapsedMinutes)} min</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { ...IOS_TYPOGRAPHY.caption2, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5, flex: 1 },
  sourceBadge: { backgroundColor: '#F0FDF4', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  sourceText: { fontSize: 10, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5 },
  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mainCol: { flex: 1 },
  remainingVal: { ...IOS_TYPOGRAPHY.largeTitle, color: '#111', lineHeight: 34 },
  remainingLbl: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280' },
  recoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '45%' },
  recoText: { ...IOS_TYPOGRAPHY.footnote, fontWeight: '600', flexShrink: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { ...IOS_TYPOGRAPHY.caption1, color: '#374151', fontWeight: '500', flex: 1 },
  footerSub: { ...IOS_TYPOGRAPHY.caption2, color: '#9CA3AF' },
});