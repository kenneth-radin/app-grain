import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatItemProps {
  label?: string;
  value?: string | number;
  unit?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

const TREND_CONFIG: Record<string, { color: string; icon: string }> = {
  up: { color: '#22C55E', icon: '↑' },
  down: { color: '#EF4444', icon: '↓' },
  stable: { color: '#6B7280', icon: '→' },
};

function StatItemInner({
  label = '',
  value = '--',
  unit = '',
  icon = '',
  trend,
  trendValue = '',
}: StatItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {trend ? (
        <View style={styles.trendRow}>
          <Text style={{ color: TREND_CONFIG[trend].color }}>
            {TREND_CONFIG[trend].icon} {trendValue}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function statPropsEqual(prev: StatItemProps, next: StatItemProps) {
  return prev.value === next.value
    && prev.label === next.label
    && prev.unit === next.unit
    && prev.trend === next.trend
    && prev.trendValue === next.trendValue;
}

export default React.memo(StatItemInner, statPropsEqual);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  unit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  trendRow: {
    marginTop: 4,
  },
});
