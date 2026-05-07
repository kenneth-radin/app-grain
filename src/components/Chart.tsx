import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart as RawLineChart, BarChart as RawBarChart } from 'react-native-chart-kit';

const LineChart = RawLineChart as React.ComponentType<any>;
const BarChart = RawBarChart as React.ComponentType<any>;

interface ChartProps {
  data: any[];
  type?: 'line' | 'bar';
  title?: string;
  dataKey?: string;
  xKey?: string;
  label?: string;
  sparkline?: boolean;
}

const MAX_POINTS = 50;
const SPARKLINE_MAX_POINTS = 20;

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0);
}

const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
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

function Chart({
  data = [],
  type = 'line',
  title = '',
  dataKey = 'value',
  xKey = 'label',
  label = '',
  sparkline = false,
}: ChartProps) {
  const { width: chartWidth } = useWindowDimensions();
  const screenWidth = chartWidth - 32;
  const maxPoints = sparkline ? SPARKLINE_MAX_POINTS : MAX_POINTS;

  const sampledData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return downsample(data, maxPoints);
  }, [data, maxPoints]);

  if (!sampledData || sampledData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const chartData = useMemo(() => ({
    labels: sampledData.map((d) => d[xKey] || ''),
    datasets: [{ data: sampledData.map((d) => d[dataKey] || 0) }],
  }), [sampledData, xKey, dataKey]);

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {type === 'line' ? (
        <LineChart
          data={chartData}
          width={screenWidth}
          height={200}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      ) : (
        <BarChart
          data={chartData}
          width={screenWidth}
          height={200}
          chartConfig={chartConfig}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix={label.includes('%') ? '%' : ''}
        />
      )}
    </View>
  );
}

function areEqual(prev: ChartProps, next: ChartProps) {
  if (prev.type !== next.type || prev.title !== next.title || prev.sparkline !== next.sparkline) return false;
  if (prev.data.length !== next.data.length) return false;
  if (prev.data.length === 0) return true;
  const prevLast = prev.data[prev.data.length - 1];
  const nextLast = next.data[next.data.length - 1];
  return prevLast === nextLast;
}

export default React.memo(Chart, areEqual);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
