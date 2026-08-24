import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
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

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const emailRef = useRef<any>(null);

  const handleSendReset = async () => {
    if (!email.trim()) {
      setErrorMessage('Email is required');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setErrorMessage('Enter a valid email address');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await grainApi.auth.forgot(email.trim());

      if (response.resetToken) {
        setResetToken(response.resetToken);
      } else {
        Alert.alert(
          'Sent',
          'If an account exists for that email, a reset link has been sent.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send reset link. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = () => {
    // Token text is selectable — users can long-press to select and copy.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (resetToken) {
    return (
      <SafeAreaViewCompat style={styles.container}>
        <StatusBar style="dark" />
        <LinearGradientCompat colors={GRADIENTS.login} style={styles.backgroundGradient} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#22C55E" />
            </View>
            <Text style={[IOS_TYPOGRAPHY.title2, styles.title]}>Reset Token Generated</Text>
            <Text style={[IOS_TYPOGRAPHY.body, styles.subtitle]}>
              If an account exists for {email.trim()}, use the reset token below to set a new password.
            </Text>

            <View style={styles.tokenBox}>
              <Text style={[IOS_TYPOGRAPHY.caption1, styles.tokenLabel]}>Reset Token</Text>
              <Text style={styles.tokenText} selectable>{resetToken}</Text>
                            <TouchableOpacity onPress={handleCopyToken} style={styles.copyButton} activeOpacity={0.8}>
                <Text style={styles.copyButtonText}>Long-press token to copy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(auth)/reset-password')}
              style={styles.nextButton}
              activeOpacity={0.8}
            >
              <Text style={[IOS_TYPOGRAPHY.headline, styles.nextButtonText]}>Continue to Reset Password</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={[IOS_TYPOGRAPHY.footnote, styles.backBtnText]}>← Back to Login</Text>
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
          <Image source={require('@/assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.card}>
            <Text style={[IOS_TYPOGRAPHY.title2, styles.title]}>Forgot Password?</Text>
            <Text style={[IOS_TYPOGRAPHY.body, styles.subtitle]}>
              Enter your email and we'll generate a reset token for you.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[IOS_TYPOGRAPHY.footnote, styles.inputLabel]}>Email Address</Text>
              <TextInput
                ref={emailRef}
                style={[styles.input, errorMessage && styles.inputError]}
                placeholder="you@example.com"
                placeholderTextColor="rgba(0,0,0,0.3)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => { setEmail(t); if (errorMessage) setErrorMessage(''); }}
                onSubmitEditing={handleSendReset}
                returnKeyType="send"
              />
              {errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null}
            </View>

            {isSubmitting ? (
              <View style={styles.submitting}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={[IOS_TYPOGRAPHY.footnote, styles.submittingText]}>Sending…</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSendReset}
                style={[styles.button, !email.trim() && styles.buttonDisabled]}
                disabled={!email.trim()}
                activeOpacity={0.8}
              >
                <Text style={[IOS_TYPOGRAPHY.headline, styles.buttonText]}>Send Reset Link</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={[IOS_TYPOGRAPHY.footnote, styles.backBtnText]}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaViewCompat>
  );
}
