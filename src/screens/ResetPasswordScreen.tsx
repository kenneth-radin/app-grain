import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { grainApi } from '@/api';
import { useRouter } from 'expo-router';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { styles } from '@/utils/resetPasswordStyles';

const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [success, setSuccess] = useState(false);
  const tokenRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);

  const handleReset = async () => {
    let valid = true;
    setTokenError(''); setPasswordError(''); setConfirmError('');

    if (!token.trim()) { setTokenError('Reset token is required'); valid = false; }
    if (!password.trim()) { setPasswordError('Password is required'); valid = false; }
    else if (password.trim().length < 6) { setPasswordError('Password must be at least 6 characters'); valid = false; }
    if (!confirmPassword.trim()) { setConfirmError('Please confirm your password'); valid = false; }
    else if (password.trim() !== confirmPassword.trim()) { setConfirmError('Passwords do not match'); valid = false; }

    if (!valid) return;

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await grainApi.auth.reset(token.trim(), password.trim());
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reset password. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <SafeAreaViewCompat style={styles.container}>
        <StatusBar style="dark" />
        <LinearGradientCompat colors={GRADIENTS.login} style={styles.backgroundGradient} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
                        <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#22C55E" />
            </View>
            <Text style={[IOS_TYPOGRAPHY.title2, styles.title]}>Password Reset!</Text>
            <Text style={[IOS_TYPOGRAPHY.body, styles.subtitle]}>
              Your password has been successfully changed.
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.button}>
              <Text style={[IOS_TYPOGRAPHY.headline, styles.buttonText]}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaViewCompat>
    );
  }

  return (
    <SafeAreaViewCompat style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.login} style={styles.backgroundGradient} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kbContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.card}>
            <Text style={[IOS_TYPOGRAPHY.title2, styles.title]}>Reset Password</Text>
            <Text style={[IOS_TYPOGRAPHY.body, styles.subtitle]}>
              Enter the reset token and your new password below.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[IOS_TYPOGRAPHY.footnote, styles.inputLabel]}>Reset Token</Text>
              <TextInput
                ref={tokenRef}
                style={[styles.input, tokenError && styles.inputError]}
                placeholder="Enter your reset token"
                placeholderTextColor="rgba(0,0,0,0.3)"
                autoCapitalize="none" autoCorrect={false}
                value={token}
                onChangeText={(t) => { setToken(t); if (tokenError) setTokenError(''); }}
                onSubmitEditing={() => passwordRef.current?.focus()}
                returnKeyType="next"
              />
              {tokenError ? <Text style={styles.inlineError}>{tokenError}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[IOS_TYPOGRAPHY.footnote, styles.inputLabel]}>New Password</Text>
              <View style={[styles.pwWrapper, passwordError && styles.inputError]}>
                <TextInput
                  ref={passwordRef}
                  style={styles.pwInput}
                  placeholder="Enter new password"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none" autoCorrect={false}
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(''); }}
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[IOS_TYPOGRAPHY.footnote, styles.inputLabel]}>Confirm New Password</Text>
              <View style={[styles.pwWrapper, confirmError && styles.inputError]}>
                <TextInput
                  ref={confirmRef}
                  style={styles.pwInput}
                  placeholder="Re-enter new password"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none" autoCorrect={false}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); if (confirmError) setConfirmError(''); }}
                  onSubmitEditing={handleReset}
                  returnKeyType="send"
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {confirmError ? <Text style={styles.inlineError}>{confirmError}</Text> : null}
            </View>

            {isSubmitting ? (
              <View style={styles.submitting}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={[IOS_TYPOGRAPHY.footnote, styles.submittingText]}>Resetting…</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleReset} style={[styles.button, isSubmitting && styles.buttonDisabled]} disabled={isSubmitting} activeOpacity={0.8}>
                <Text style={[IOS_TYPOGRAPHY.headline, styles.buttonText]}>Reset Password</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={[IOS_TYPOGRAPHY.footnote, styles.backBtnText]}>← Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaViewCompat>
  );
}

