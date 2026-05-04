import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import CustomSlider from './Slider';
import { COLORS, IOS_TYPOGRAPHY, DRYING } from '@/utils/constants';
import { DryerMode } from '@/utils/enums';

interface TemperatureSliderProps {
  mode: DryerMode;
  temperature: number;
  fanSpeed: number;
  onTemperatureChange: (temp: number) => void;
  onFanSpeedChange: (speed: number) => void;
  onModeChange: (mode: DryerMode) => void;
}

export function TemperatureSlider({
  mode,
  temperature,
  fanSpeed,
  onTemperatureChange,
  onFanSpeedChange,
  onModeChange,
}: TemperatureSliderProps) {
  const isAuto = mode === DryerMode.Auto;

  return (
    <>
      <View style={[styles.card, isAuto && styles.cardDisabled]}>
        <Text style={styles.cardLabel}>ADVANCED SETTINGS</Text>
        {isAuto && (
          <View style={styles.disabledOverlay}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.gray[400]} />
            <Text style={styles.disabledText}>Manual control disabled in Auto mode</Text>
          </View>
        )}
        <View style={[styles.sliderSection, isAuto && styles.sliderDisabled]}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Temperature</Text>
            <Text style={styles.sliderValue}>{temperature.toFixed(1)} °C</Text>
          </View>
          <CustomSlider
            label=""
            value={temperature}
            minimumValue={DRYING.TEMP_MIN}
            maximumValue={DRYING.TEMP_MAX}
            step={DRYING.TEMP_STEP}
            unit=" °C"
            onValueChange={onTemperatureChange}
          />
        </View>

        <View style={[styles.sliderSection, isAuto && styles.sliderDisabled]}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>Fan Speed</Text>
            <Text style={styles.sliderValue}>{fanSpeed} %</Text>
          </View>
          <CustomSlider
            label=""
            value={fanSpeed}
            minimumValue={DRYING.FAN_MIN}
            maximumValue={DRYING.FAN_MAX}
            step={DRYING.FAN_STEP}
            unit=" %"
            onValueChange={onFanSpeedChange}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>QUICK PRESETS</Text>
        <View style={styles.presetsRow}>
          <TouchableOpacity
            style={[styles.presetButton, styles.presetHigh]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTemperatureChange(DRYING.PRESET_HIGH_TEMP);
              onFanSpeedChange(DRYING.PRESET_HIGH_FAN);
              onModeChange(DryerMode.Manual);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="flame-outline" size={18} color={COLORS.danger} />
            <Text style={styles.presetHighText}>High Speed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, styles.presetMedium]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTemperatureChange(DRYING.PRESET_MEDIUM_TEMP);
              onFanSpeedChange(DRYING.PRESET_MEDIUM_FAN);
              onModeChange(DryerMode.Manual);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color={COLORS.warning} />
            <Text style={styles.presetMediumText}>Medium Speed</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
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
  cardDisabled: {
    opacity: 0.5,
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
  sliderSection: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  sliderValue: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sliderDisabled: {
    opacity: 0.4,
    pointerEvents: 'none',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  presetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 50,
  },
  presetHigh: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  presetHighText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: COLORS.danger,
  },
  presetMedium: {
    backgroundColor: 'rgba(217,119,6,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.2)',
  },
  presetMediumText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: COLORS.warning,
  },
});
