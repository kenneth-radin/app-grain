import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DeviceStatus, DryerStatus, AlertType } from '@/utils/enums';

interface StatusBadgeProps {
  status?: DeviceStatus | DryerStatus | AlertType | 'paused' | 'drying';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  online: { color: '#16A34A', bg: '#DCFCE7', label: 'Online' },
  offline: { color: '#9CA3AF', bg: '#F3F4F6', label: 'Offline' },
  running: { color: '#CA8A04', bg: '#FEF9C3', label: 'Running' },
  idle: { color: '#CA8A04', bg: '#FEF9C3', label: 'Idle' },
  error: { color: '#DC2626', bg: '#FEE2E2', label: 'Error' },
  paused: { color: '#2563EB', bg: '#DBEAFE', label: 'Paused' },
  active: { color: '#16A34A', bg: '#DCFCE7', label: 'Active' },
};

const SIZE_CONFIG = {
  sm: { dot: 6, text: 10, px: 6, py: 2 },
  md: { dot: 8, text: 12, px: 8, py: 4 },
  lg: { dot: 10, text: 14, px: 10, py: 5 },
};

function StatusBadgeInner({
  status = DeviceStatus.Online,
  label,
  size = 'md',
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.online;
  const sizeConf = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const displayLabel = label || config.label;

  return (
    <View style={[styles.container, { backgroundColor: config.bg, paddingHorizontal: sizeConf.px, paddingVertical: sizeConf.py }]}>
      <View style={[styles.dot, { width: sizeConf.dot, height: sizeConf.dot, backgroundColor: config.color, borderRadius: sizeConf.dot / 2 }]} />
      <Text style={[styles.text, { fontSize: sizeConf.text, color: config.color }]}>{displayLabel}</Text>
    </View>
  );
}

function badgePropsEqual(prev: StatusBadgeProps, next: StatusBadgeProps) {
  return prev.status === next.status
    && prev.size === next.size
    && prev.label === next.label;
}

export default React.memo(StatusBadgeInner, badgePropsEqual);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: {
    marginRight: 0,
  },
  text: {
    fontWeight: '600',
  },
});
