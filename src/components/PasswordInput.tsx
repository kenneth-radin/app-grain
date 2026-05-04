import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, IOS_TYPOGRAPHY } from '@/utils/constants';

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputRef?: any;
  style?: any;
}

export function PasswordInput({
  value,
  onChangeText,
  placeholder = 'Enter your password',
  editable = true,
  returnKeyType = 'go',
  onSubmitEditing,
  inputRef,
  style,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      <TouchableOpacity
        onPress={() => setShowPassword(!showPassword)}
        style={styles.eyeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={COLORS.gray[400]}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingRight: 12,
  },
  input: {
    flex: 1,
    ...IOS_TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eyeButton: {
    padding: 4,
  },
});
