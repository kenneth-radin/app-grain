import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { DryerMode } from '@/utils/enums';
import ModeToggle from './ModeToggle';

interface DryerModeSelectorProps {
  mode: DryerMode;
  isRunning: boolean;
  isControlling: boolean;
  onModeChange: (mode: DryerMode) => void;
  onStart: () => void;
  onStop: () => void;
  deviceName?: string;
}

export function DryerModeSelector({
  mode,
  isRunning,
  isControlling,
  onModeChange,
  onStart,
  onStop,
  deviceName,
}: DryerModeSelectorProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>SYSTEM STATUS</Text>
      <View style={styles.statusRow}>
        <Ionicons name="ellipse" size={12} color={isRunning ? COLORS.primary : COLORS.gray[400]} />
        <Text style={isRunning ? styles.statusTextGreen : styles.statusTextGray}>
          {isRunning ? 'Running' : 'Idle'}
        </Text>
      </View>
      {deviceName ? (
        <Text style={styles.deviceLabel}>Device: {deviceName}</Text>
      ) : null}

      {isRunning ? (
        <TouchableOpacity
          style={[styles.stopButton, isControlling && styles.buttonDisabled]}
          onPress={onStop}
          disabled={isControlling}
          activeOpacity={0.7}
        >
          {isControlling ? null : (
            <>
              <Ionicons name="stop" size={20} color={COLORS.white} />
              <Text style={styles.stopButtonText}>Stop Dryer</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.startButton, isControlling && styles.buttonDisabled]}
          onPress={onStart}
          disabled={isControlling}
          activeOpacity={0.7}
        >
          {isControlling ? null : (
            <>
              <Ionicons name="play" size={20} color={COLORS.white} />
              <Text style={styles.startButtonText}>Start Dryer</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <Text style={[styles.cardLabel, { marginTop: 24 }]}>OPERATING MODE</Text>
      <ModeToggle mode={mode} onModeChange={(m: string) => onModeChange(m as DryerMode)} />
    </View>
  );
}

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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusTextGreen: {
    ...IOS_TYPOGRAPHY.title1,
    color: COLORS.primary,
  },
  statusTextGray: {
    ...IOS_TYPOGRAPHY.title1,
    color: COLORS.gray[400],
  },
  deviceLabel: {
    ...IOS_TYPOGRAPHY.footnote,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 50,
    paddingVertical: 12,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stopButtonText: {
    color: COLORS.white,
    ...IOS_TYPOGRAPHY.headline,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    paddingVertical: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: COLORS.white,
    ...IOS_TYPOGRAPHY.headline,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
