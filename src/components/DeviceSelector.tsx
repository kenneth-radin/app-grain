import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { Device } from '@/api';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device) => void;
}

export function DeviceSelector({ devices, selectedDevice, onSelectDevice }: DeviceSelectorProps) {
  if (devices.length <= 1) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>SELECT DEVICE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceScroll}>
        {devices.map((device) => (
          <TouchableOpacity
            key={device._id || device.deviceId}
            style={[
              styles.deviceChip,
              selectedDevice?.deviceId === device.deviceId && styles.deviceChipActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectDevice(device);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.deviceChipText,
                selectedDevice?.deviceId === device.deviceId && styles.deviceChipTextActive,
              ]}
            >
              {device.name || device.deviceId}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  deviceScroll: {
    flexDirection: 'row',
  },
  deviceChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: COLORS.gray[100],
    marginRight: 8,
  },
  deviceChipActive: {
    backgroundColor: COLORS.primary,
  },
  deviceChipText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  deviceChipTextActive: {
    color: COLORS.white,
  },
});
