import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView as RawBlurView } from 'expo-blur';
import { GLASS } from '@/utils/constants';

const BlurView = RawBlurView as React.ComponentType<any>;

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  borderRadius?: number;
  padding?: number;
}

export default function GlassCard({
  children,
  style,
  intensity = GLASS.intensity,
  borderRadius = GLASS.borderRadius,
  padding = 16,
}: GlassCardProps) {
  return (
    <BlurView intensity={intensity} tint={GLASS.tint} style={[styles.blur, { borderRadius, padding }, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    backgroundColor: GLASS.backgroundColor,
    borderWidth: 1,
    borderColor: GLASS.borderColor,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: GLASS.shadowOpacity,
    shadowRadius: GLASS.shadowRadius,
    elevation: 5,
  },
});
