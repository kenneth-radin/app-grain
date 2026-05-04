import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';

interface FilterOption {
  key: string;
  label: string;
  activeBg?: string;
}

interface FilterPillsProps {
  options: FilterOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  activeColor?: string;
}

export function FilterPills({
  options,
  selectedKey,
  onSelect,
  activeColor = COLORS.primary,
}: FilterPillsProps) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isActive = selectedKey === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.pill,
              isActive && { backgroundColor: opt.activeBg || activeColor },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(opt.key);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pillText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pillTextActive: {
    color: COLORS.white,
  },
});
