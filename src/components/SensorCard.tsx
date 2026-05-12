import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface SensorCardProps {
  type?: 'temperature' | 'humidity' | 'fanSpeed' | 'moisture' | 'energy' | 'weight';
  value?: number | string;
  unit?: string;
  label?: string;
  status?: 'normal' | 'warning' | 'critical';
  onPress?: () => void;
}

const SENSOR_CONFIG: Record<string, { icon: IoniconName; color: string; bg: string; unit: string }> = {
  temperature: { icon: 'thermometer-outline', color: '#F97316', bg: '#FFF7ED', unit: '°C' },
  humidity: { icon: 'water-outline', color: '#22C55E', bg: '#F0FDF4', unit: '%' },
  fanSpeed: { icon: 'speedometer-outline', color: '#F97316', bg: '#FFF7ED', unit: '%' },
  moisture: { icon: 'analytics-outline', color: '#22C55E', bg: '#F0FDF4', unit: '%' },
  energy: { icon: 'flash-outline', color: '#22C55E', bg: '#F0FDF4', unit: 'kWh' },
  weight: { icon: 'scale-outline', color: '#3B82F6', bg: '#EFF6FF', unit: 'kg' },
};

const STATUS_CONFIG = {
  normal: { color: '#22C55E', label: '● Normal' },
  warning: { color: '#FBBF24', label: '● Warning' },
  critical: { color: '#EF4444', label: '● Critical' },
};

function SensorCardInner({
  type = 'temperature',
  value = 0,
  unit = '',
  label = '',
  status = 'normal',
  onPress,
}: SensorCardProps) {
  const config = SENSOR_CONFIG[type] || SENSOR_CONFIG.temperature;
  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.normal;
  const displayUnit = unit || config.unit;
  const displayValue = typeof value === 'number' ? parseFloat(value.toFixed(1)) : value;

  const content = (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon} size={22} color={config.color} />
      </View>
      <Text style={[styles.value, { color: config.color }]}>{displayValue}</Text>
      <Text style={styles.label}>{label || type} ({displayUnit})</Text>
      <Text style={[styles.status, { color: statusConf.color }]}>{statusConf.label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function sensorPropsEqual(prev: SensorCardProps, next: SensorCardProps) {
  return prev.value === next.value
    && prev.label === next.label
    && prev.status === next.status
    && prev.type === next.type
    && prev.unit === next.unit
    && prev.onPress === next.onPress;
}

export default React.memo(SensorCardInner, sensorPropsEqual);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
});
