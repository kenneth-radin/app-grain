import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';

const ALERT_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: '#FEE2E2', border: COLORS.danger, text: '#DC2626', icon: 'alert-circle' },
  warning: { bg: '#FEF9C3', border: '#F59E0B', text: '#D97706', icon: 'warning' },
  info: { bg: '#EFF6FF', border: COLORS.info, text: '#2563EB', icon: 'information-circle' },
};

interface DryingAlertBannerProps {
  severity: string;
  message: string;
  action: string;
}

export function DryingAlertBanner({ severity, message, action }: DryingAlertBannerProps) {
  const c = ALERT_COLORS[severity] || ALERT_COLORS.info;
  return (
    <View style={[styles.banner, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Ionicons name={c.icon as any} size={20} color={c.text} />
      <View style={styles.content}>
        <Text style={[styles.message, { color: c.text }]}>{message}</Text>
        <Text style={styles.action}>{action}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  message: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
  },
  action: {
    ...IOS_TYPOGRAPHY.caption1,
    color: COLORS.textSecondary,
  },
});
