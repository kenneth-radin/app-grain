import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LineChart as RawLineChart } from 'react-native-chart-kit';
import { Header } from '@/components';
import { useAIPrediction } from '@/hooks/useAIPrediction';
import type { AIPrediction } from '@/hooks/useAIPrediction';
import { useToast } from '@/context/AppContext';
import { GRADIENTS, IOS_TYPOGRAPHY, DRYING } from '@/utils/constants';

const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;
const AnimatedView = Animated.View as React.ComponentType<any>;
const LineChart = RawLineChart as React.ComponentType<any>;

const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  fillShadowGradient: '#22C55E',
  fillShadowGradientOpacity: 0.15,
  decimalPlaces: 1,
  color: (opacity: number = 1) => `rgba(34, 197, 94, ${opacity})`,
  labelColor: (opacity: number = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#22C55E' },
};

export default function AIPredictionScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 48;
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();
  const { prediction, isLoading, isOfflineFallback, refetch } = useAIPrediction(undefined, {
    pollInterval: DRYING.AI_POLL_INTERVAL_MS,
    autoFetch: true,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
    showToast('AI predictions refreshed', 'success');
  }, [refetch, showToast]);

  const formatTime = (minutes: number): string => {
    if (!isFinite(minutes) || minutes <= 0) return 'Complete';
    const total = Math.round(minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getMoistureColor = (moisture: number): string => {
    if (moisture > 20) return '#F97316';
    if (moisture > 14) return '#FBBF24';
    return '#22C55E';
  };

  const getRecommendationStyle = (type: 'optimal' | 'warning' | 'critical') => {
    switch (type) {
      case 'critical': return { bg: '#FEE2E2', border: '#EF4444', icon: 'alert-circle' as const, text: '#DC2626' };
      case 'warning': return { bg: '#FEF9C3', border: '#F59E0B', icon: 'warning' as const, text: '#D97706' };
      default: return { bg: '#DCFCE7', border: '#22C55E', icon: 'checkmark-circle' as const, text: '#16A34A' };
    }
  };

  const recStyle = prediction ? getRecommendationStyle(prediction.recommendationType) : getRecommendationStyle('optimal');

  // Build chart data from projected curve (show every other label to avoid crowding)
  const curveChartData = prediction?.projectedMoistureCurve
    ? {
        labels: prediction.projectedMoistureCurve.map((p, i) => i % 2 === 0 ? `${p.time}` : ''),
        datasets: [
          {
            data: prediction.projectedMoistureCurve.map((p) => Math.max(0.1, p.moisture)),
            color: (opacity: number = 1) => `rgba(249, 115, 22, ${opacity})`,
          },
        ],
      }
    : {
        labels: ['0', '', '60', '', '120', '', '180'],
        datasets: [{ data: [20, 18, 16.5, 15.2, 14.1, 13.2, 12.5] }],
      };

  return (
    <SafeAreaViewCompat style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.analytics} style={styles.gradient}>
        <Header />
        <AnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.titleRow}>
              <Ionicons name="sparkles" size={24} color="#22C55E" />
              <Text style={styles.screenTitle}>AI Predictions</Text>
              {isOfflineFallback && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline-outline" size={12} color="#F97316" />
                  <Text style={styles.offlineBadgeText}>Offline</Text>
                </View>
              )}
            </View>
            <Text style={styles.screenSubtitle}>AI-Assisted drying optimization</Text>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22C55E" />
                <Text style={styles.loadingText}>Analyzing drying data...</Text>
              </View>
            ) : prediction ? (
              <View>
              <TouchableOpacity style={styles.runButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetch(); }} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={16} color="#22C55E" />
                <Text style={styles.runButtonText}>Run Prediction</Text>
              </TouchableOpacity>
                {/* Card 1: Predicted Moisture */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="water-outline" size={20} color="#22C55E" />
                    <Text style={styles.cardTitle}>Predicted Moisture (30 min)</Text>
                  </View>
                  <Text style={[styles.bigValue, { color: getMoistureColor(prediction.predictedMoisture30min) }]}>
                    {prediction.predictedMoisture30min}%
                  </Text>
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, (1 - prediction.predictedMoisture30min / 30) * 100)}%`, backgroundColor: getMoistureColor(prediction.predictedMoisture30min) }]} />
                    </View>
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Current → Predicted → 14% Target</Text>
                  </View>
                  <Text style={styles.cardSubtext}>Based on current drying trend</Text>
                </View>

                {/* Card 2: Estimated Time */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="time-outline" size={20} color="#22C55E" />
                    <Text style={styles.cardTitle}>Est. Time to Target</Text>
                  </View>
                  {prediction.isDryingComplete ? (
                    <View style={styles.completeRow}>
                      <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
                      <Text style={styles.completeText}>Drying Complete</Text>
                    </View>
                  ) : (
                    <Text style={styles.countdownValue}>{formatTime(prediction.estimatedMinutesToTarget)}</Text>
                  )}
                  <Text style={styles.cardSubtext}>Target: 14% moisture for safe storage</Text>
                </View>

                {/* Card 3: AI Recommendation */}
                <View style={[styles.card, { backgroundColor: recStyle.bg, borderColor: recStyle.border, borderWidth: 1.5 }]}>
                  <View style={styles.cardHeader}>
                    <Ionicons name={recStyle.icon} size={20} color={recStyle.text} />
                    <Text style={[styles.cardTitle, { color: recStyle.text }]}>AI Recommendation</Text>
                  </View>
                  <Text style={[styles.recommendationText, { color: recStyle.text }]}>
                    {prediction.recommendation}
                  </Text>
                  <View style={styles.aiLabel}>
                    <Ionicons name="sparkles-outline" size={12} color={recStyle.text} />
                    <Text style={[styles.aiLabelText, { color: recStyle.text }]}>AI-Assisted</Text>
                  </View>
                </View>

                {/* Card 4: 2x2 Mini Stats Grid */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="stats-chart-outline" size={20} color="#22C55E" />
                    <Text style={styles.cardTitle}>AI Metrics</Text>
                  </View>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Efficiency</Text>
                      <Text style={[styles.statValue, { color: prediction.efficiencyScore >= 70 ? '#22C55E' : prediction.efficiencyScore >= 40 ? '#FBBF24' : '#EF4444' }]}>{prediction.efficiencyScore}%</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Confidence</Text>
                      <Text style={[styles.statValue, { color: prediction.confidence >= 80 ? '#22C55E' : prediction.confidence >= 60 ? '#FBBF24' : '#EF4444' }]}>{prediction.confidence}%</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Target</Text>
                      <Text style={styles.statValue}>{prediction.targetMoisture}%</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Status</Text>
                      <Text style={[styles.statValue, { color: prediction.isDryingComplete ? '#22C55E' : '#F97316' }]}>{prediction.isDryingComplete ? 'Complete' : 'Drying'}</Text>
                    </View>
                  </View>
                </View>

                {/* Card 5: Moisture Trend Chart */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="trending-down-outline" size={20} color="#22C55E" />
                    <Text style={styles.cardTitle}>Projected Moisture Curve</Text>
                  </View>
                  <LineChart
                    data={curveChartData}
                    width={chartWidth}
                    height={200}
                    chartConfig={{
                      ...chartConfig,
                      color: (opacity: number = 1) => `rgba(249, 115, 22, ${opacity})`,
                    }}
                    bezier
                    style={styles.chart}
                  />
                  <View style={styles.targetLine}>
                    <View style={styles.targetDash} />
                    <Text style={styles.targetLabel}>14% Safe Storage Level</Text>
                  </View>
                  <View style={styles.aiLabel}>
                    <Ionicons name="sparkles-outline" size={12} color="#6B7280" />
                    <Text style={styles.aiLabelText}>AI-Assisted Projection</Text>
                  </View>
                </View>

                {/* Card 6: Algorithm Info */}
                <View style={styles.algorithmCard}>
                  <View style={styles.algorithmRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                    <View style={styles.algorithmInfo}>
                      <Text style={styles.algorithmText}>AI Model: {prediction.algorithm || 'Rule-based Drying Model v1'}</Text>
                      <Text style={styles.algorithmSubtext}>
                        {prediction.algorithm?.includes('RandomForest')
                          ? 'Trained on rice drying data (R² = 0.91)'
                          : 'Fallback model active — ML service warming up'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <Ionicons name="sparkles-outline" size={48} color="#6B7280" />
                <Text style={styles.loadingText}>No prediction data available</Text>
                <TouchableOpacity style={styles.runButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetch(); }} activeOpacity={0.7}>
                  <Ionicons name="refresh-outline" size={16} color="#22C55E" />
                  <Text style={styles.runButtonText}>Run Prediction</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </AnimatedView>
      </LinearGradientCompat>
    </SafeAreaViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 72, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  screenTitle: { ...IOS_TYPOGRAPHY.largeTitle, color: '#111111' },
  screenSubtitle: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280', marginBottom: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...IOS_TYPOGRAPHY.headline, color: '#111111' },
  cardSubtext: { ...IOS_TYPOGRAPHY.caption1, color: '#6B7280' },
  bigValue: { fontSize: 36, fontWeight: '700' },
  progressRow: { marginVertical: 4 },
  progressTrack: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...IOS_TYPOGRAPHY.caption2, color: '#9CA3AF' },
  countdownValue: { fontSize: 36, fontWeight: '700', color: '#111111' },
  completeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  completeText: { fontSize: 24, fontWeight: '700', color: '#22C55E' },
  recommendationText: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  aiLabelText: { ...IOS_TYPOGRAPHY.caption2, color: '#6B7280', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { flex: 1, minWidth: '45%', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statLabel: { ...IOS_TYPOGRAPHY.caption2, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111111' },
  chart: { borderRadius: 16 },
  targetLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  targetDash: { flex: 1, height: 1, backgroundColor: '#EF4444', borderStyle: 'dashed' },
  targetLabel: { ...IOS_TYPOGRAPHY.caption2, color: '#EF4444', fontWeight: '600' },
  algorithmCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, gap: 4 },
  algorithmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  algorithmInfo: { flex: 1, gap: 2 },
  algorithmText: { ...IOS_TYPOGRAPHY.caption1, color: '#6B7280' },
  algorithmSubtext: { ...IOS_TYPOGRAPHY.caption2, color: '#9CA3AF' },
  loadingContainer: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  loadingText: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  offlineBadgeText: { ...IOS_TYPOGRAPHY.caption2, color: '#F97316', fontWeight: '600' },
  runButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 50, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1.5, borderColor: '#22C55E', marginBottom: 4 },
  runButtonText: { ...IOS_TYPOGRAPHY.callout, color: '#22C55E', fontWeight: '600' },
});
