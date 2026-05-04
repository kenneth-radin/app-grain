import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { DryerMode } from '@/utils/enums';

interface FanControlPanelProps {
  mode: DryerMode;
  fan1Status: 'ON' | 'OFF';
  fan2Status: 'ON' | 'OFF';
  fan1Loading: boolean;
  fan2Loading: boolean;
  bothLoading: boolean;
  onFanControl: (fan: 'FAN1' | 'FAN2' | 'ALL', action: 'ON' | 'OFF') => void;
}

export function FanControlPanel({
  mode,
  fan1Status,
  fan2Status,
  fan1Loading,
  fan2Loading,
  bothLoading,
  onFanControl,
}: FanControlPanelProps) {
  if (mode === DryerMode.Auto) {
    return (
      <View style={styles.card}>
        <View style={styles.disabledOverlay}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.gray[400]} />
          <Text style={styles.disabledText}>Fan control is managed automatically in AUTO mode</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.fanControlHeader}>
        <Ionicons name="aperture-outline" size={18} color={COLORS.textSecondary} />
        <Text style={styles.cardLabel}>FAN CONTROL</Text>
      </View>

      <FanRow
        label="Fan 1"
        status={fan1Status}
        loading={fan1Loading || bothLoading}
        onOn={() => onFanControl('FAN1', 'ON')}
        onOff={() => onFanControl('FAN1', 'OFF')}
      />

      <FanRow
        label="Fan 2"
        status={fan2Status}
        loading={fan2Loading || bothLoading}
        onOn={() => onFanControl('FAN2', 'ON')}
        onOff={() => onFanControl('FAN2', 'OFF')}
      />

      {/* Both Fans */}
      <View style={styles.fanBothRow}>
        <TouchableOpacity
          style={[styles.fanBothButton, styles.fanBothOn, bothLoading && styles.buttonDisabled]}
          onPress={() => onFanControl('ALL', 'ON')}
          disabled={fan1Loading || fan2Loading || bothLoading}
          activeOpacity={0.7}
        >
          {bothLoading && fan1Status === 'ON' ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.fanBothButtonText}>Turn Both ON</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fanBothButton, styles.fanBothOff, bothLoading && styles.buttonDisabled]}
          onPress={() => onFanControl('ALL', 'OFF')}
          disabled={fan1Loading || fan2Loading || bothLoading}
          activeOpacity={0.7}
        >
          {bothLoading && fan1Status === 'OFF' ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.fanBothOffButtonText}>Turn Both OFF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Internal FanRow ──────────────────────────────────────

function FanRow({
  label,
  status,
  loading,
  onOn,
  onOff,
}: {
  label: string;
  status: 'ON' | 'OFF';
  loading: boolean;
  onOn: () => void;
  onOff: () => void;
}) {
  return (
    <View style={styles.fanRow}>
      <View style={styles.fanLabelRow}>
        <Ionicons name="aperture-outline" size={16} color={status === 'ON' ? COLORS.primary : COLORS.gray[400]} />
        <Text style={styles.fanLabel}>{label}</Text>
        <View style={styles.fanStatusRow}>
          <View style={[styles.fanDot, status === 'ON' ? styles.fanDotOn : styles.fanDotOff]} />
          <Text style={[styles.fanStatusText, status === 'ON' ? styles.fanStatusOn : styles.fanStatusOff]}>
            {status}
          </Text>
        </View>
      </View>
      <View style={styles.fanButtonsRow}>
        <TouchableOpacity
          style={[styles.fanButton, status === 'ON' && styles.fanButtonOnActive, loading && styles.buttonDisabled]}
          onPress={onOn}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading && status === 'ON' ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={[styles.fanButtonText, status === 'ON' && styles.fanButtonTextActive]}>ON</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fanButton, status === 'OFF' && styles.fanButtonOffActive, loading && styles.buttonDisabled]}
          onPress={onOff}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading && status === 'OFF' ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={[styles.fanButtonText, status === 'OFF' && styles.fanButtonTextActive]}>OFF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLabel: {
    ...IOS_TYPOGRAPHY.caption2,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  disabledOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  disabledText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: COLORS.gray[400],
    fontWeight: '500',
  },
  fanControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  fanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  fanLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  fanLabel: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  fanStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fanDotOn: {
    backgroundColor: COLORS.primary,
  },
  fanDotOff: {
    backgroundColor: COLORS.gray[400],
  },
  fanStatusText: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
  },
  fanStatusOn: {
    color: COLORS.primary,
  },
  fanStatusOff: {
    color: COLORS.gray[400],
  },
  fanButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fanButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: COLORS.gray[100],
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanButtonOnActive: {
    backgroundColor: COLORS.primary,
  },
  fanButtonOffActive: {
    backgroundColor: COLORS.danger,
  },
  fanButtonText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  fanButtonTextActive: {
    color: COLORS.white,
  },
  fanBothRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  fanBothButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanBothOn: {
    backgroundColor: COLORS.primary,
  },
  fanBothOff: {
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  fanBothButtonText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: COLORS.white,
  },
  fanBothOffButtonText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: COLORS.danger,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
