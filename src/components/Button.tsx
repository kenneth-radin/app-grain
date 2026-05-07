import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface ButtonProps {
  label?: string;
  onPress?: () => void;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  label,
  onPress,
  onClick,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  loading = false,
  children,
  style,
}: ButtonProps) {
  const variantStyles = {
    primary: { backgroundColor: disabled ? '#9ca3af' : '#22c55e' },
    secondary: { backgroundColor: disabled ? '#d1d5db' : '#d1d5db' },
    danger: { backgroundColor: disabled ? '#9ca3af' : '#ef4444' },
    outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#22c55e' },
  };

  const textColors = {
    primary: '#ffffff',
    secondary: '#111827',
    danger: '#ffffff',
    outline: '#22c55e',
  };

  return (
    <TouchableOpacity
      onPress={onPress || onClick}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        variantStyles[variant] || variantStyles.primary,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ] as any}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={textColors[variant] || '#ffffff'} />
          <Text style={[styles.text, { color: textColors[variant] || '#ffffff' }]}>Loading...</Text>
        </View>
      ) : (
        <Text style={[styles.text, { color: textColors[variant] || '#ffffff' }]}>{label || children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
