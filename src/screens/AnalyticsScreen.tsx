import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LineChart as RawLineChart, BarChart as RawBarChart } from 'react-native-chart-kit';
import { Header, ErrorBoundary } from '@/components';
import { grainApi } from '@/api';
import { useToast } from '@/context/AppContext';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';
import type { AnalyticsOverview } from '@/api';

const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;
const AnimatedView = Animated.View as React.ComponentType<any>;
const LineChart = RawLineChart as React.ComponentType<any>;
const BarChart = RawBarChart as React.ComponentType<any>;

type PeriodType = 'daily' | 'weekly' | 'monthly';

const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  fillShadowGradient: '#FFFFFF',
  fillShadowGradientOpacity: 0,
  decimalPlaces: 1,
  color: (opacity: number = 1) => `rgba(34, 197, 94, ${opacity})`,
  labelColor: (opacity: number = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#22C55E',
  },
};

const fallbackData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
};

export default function AnalyticsScreen() {
  const { width: chartWidth } = useWindowDimensions();
  const screenWidth = chartWidth - 48;
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('weekly');
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await grainApi.analytics.getOverview(period);
      setOverview(data);
    } catch (err: any) {
      setOverview(null);
      const msg = err?.status === 500 || err?.status === 502 || err?.status === 503
        ? 'Server unavailable — pull to retry'
        : (err?.message || 'Failed to load analytics');
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const periods: { key: PeriodType; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  const moistureTrend = overview?.moistureTrend ?? [];
  const dryingCycles = overview?.dryingCycles ?? [];
  const energyConsumption = overview?.energyConsumption ?? [];

  const safeChartData = (items: Array<{ label: string; value: number }> | undefined | null, fallback: typeof fallbackData) => {
    if (!items || !Array.isArray(items) || items.length === 0) return fallback;
    try {
      const values = items.map((d) => d?.value ?? 0);
      const safeValues = values.map((v) => Math.max(v, 0.1));
      return {
        labels: items.map((d) => d?.label || '--'),
        datasets: [{ data: safeValues }],
      };
    } catch {
      return fallback;
    }
  };

  const moistureChartData = moistureTrend.length > 0
    ? { labels: moistureTrend.map((d) => d?.label || '--'), datasets: [{ data: moistureTrend.map((d) => d?.value ?? 0) }] }
    : fallbackData;

  const cycleChartData = safeChartData(dryingCycles, fallbackData);
  const energyChartData = safeChartData(energyConsumption, fallbackData);

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
            <Text style={styles.screenTitle}>Analytics</Text>
            <Text style={styles.screenSubtitle}>View drying trends and performance metrics</Text>

            <View style={styles.filterRow}>
              {periods.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.filterButton, period === p.key && styles.filterActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPeriod(p.key); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, period === p.key && styles.filterActiveText]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.exportRow}>
              <TouchableOpacity style={styles.exportButton} activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); showToast('CSV export coming soon', 'info'); }}>
                <Ionicons name="document-text-outline" size={16} color="#22C55E" />
                <Text style={styles.exportText}>Export CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportButton} activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); showToast('PDF export coming soon', 'info'); }}>
                <Ionicons name="document-attach-outline" size={16} color="#22C55E" />
                <Text style={styles.exportText}>Export PDF</Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22C55E" />
                <Text style={styles.loadingText}>Loading analytics...</Text>
              </View>
            ) : !overview ? (
              <View style={styles.loadingContainer}>
                <Ionicons name={fetchError ? 'cloud-offline-outline' : 'bar-chart-outline'} size={48} color="#D1D5DB" />
                <Text style={styles.loadingText}>{fetchError ?? 'No analytics data available'}</Text>
                {!fetchError && <Text style={styles.loadingText}>Start a drying cycle to see trends</Text>}
              </View>
            ) : (
              <ErrorBoundary>
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Moisture Levels Over Time</Text>
                  <LineChart
                    data={moistureChartData}
                    width={screenWidth}
                    height={200}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                  />
                </View>

                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Drying Cycle Duration</Text>
                  <BarChart
                    data={cycleChartData}
                    width={screenWidth}
                    height={200}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    yAxisLabel=""
                    yAxisSuffix="hrs"
                  />
                </View>

                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Weekly Energy Consumption</Text>
                  <BarChart
                    data={energyChartData}
                    width={screenWidth}
                    height={200}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    yAxisLabel=""
                    yAxisSuffix="kWh"
                  />
                </View>
              </ErrorBoundary>
            )}
          </ScrollView>
        </AnimatedView>
      </LinearGradientCompat>
    </SafeAreaViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 72,
    gap: 12,
  },
  screenTitle: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: '#111111',
  },
  screenSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterActive: {
    backgroundColor: '#22C55E',
  },
  filterText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterActiveText: {
    color: '#FFFFFF',
  },
  exportRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    backgroundColor: '#FFFFFF',
  },
  exportText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#22C55E',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#111111',
    marginBottom: 8,
  },
  chart: {
    borderRadius: 16,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
  },
});
