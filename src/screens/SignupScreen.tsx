import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { grainApi } from '@/api';
import { validateEmail } from '@/utils/validators';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';

const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;

export default function SignupScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);

  // Clear inline errors on input change
  const clearFieldErrors = () => { setNameError(''); setEmailError(''); setPasswordError(''); setConfirmError(''); setError(null); };

  const handleSignup = async () => {
    setError(null);
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmError('');
    let valid = true;

    if (!name.trim()) { setNameError('Name is required'); valid = false; }
    if (!email.trim()) { setEmailError('Email is required'); valid = false; }
    else if (!validateEmail(email.trim())) { setEmailError('Enter a valid email address'); valid = false; }
    if (!password.trim()) { setPasswordError('Password is required'); valid = false; }
    else if (password.length < 6) { setPasswordError('Password must be at least 6 characters'); valid = false; }
    if (!confirmPassword.trim()) { setConfirmError('Please confirm your password'); valid = false; }
    else if (password !== confirmPassword) { setConfirmError('Passwords do not match'); valid = false; }
    if (!valid) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await grainApi.auth.register(name.trim(), email.trim(), password.trim());
      await login(email.trim(), password.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)/dashboard');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const status = err?.status;
      const message = status === 500
        ? 'Server is temporarily unavailable. Please try again.'
        : err?.message || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaViewCompat style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.login} style={styles.gradient}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.appName}>
                gr<Text style={styles.appNameAccent}>AI</Text>n
              </Text>
              <Text style={styles.appTagline}>IoT Grain Dryer System</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create Your Account</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={[styles.input, nameError ? styles.inputError : null]}
                  value={name}
                  onChangeText={(t) => { setName(t); setNameError(''); }}
                  placeholder="Enter your full name"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
                {nameError ? <Text style={styles.inlineError}>{nameError}</Text> : null}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  ref={emailRef}
                  style={[styles.input, emailError ? styles.inputError : null]}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                {emailError ? <Text style={styles.inlineError}>{emailError}</Text> : null}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={[styles.passwordWrapper, passwordError ? styles.inputError : null]}>
                  <TextInput
                    ref={passwordRef}
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                    placeholder="Create a password"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={[styles.passwordWrapper, confirmError ? styles.inputError : null]}>
                  <TextInput
                    ref={confirmRef}
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={(t) => { setConfirmPassword(t); setConfirmError(''); }}
                    placeholder="Confirm your password"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    editable={!isLoading}
                    returnKeyType="go"
                    onSubmitEditing={handleSignup}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                {confirmError ? <Text style={styles.inlineError}>{confirmError}</Text> : null}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.createButton, isLoading && styles.createButtonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.createButtonText}>Creating account…</Text>
                  </View>
                ) : (
                  <Text style={styles.createButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signInLink}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace('/(auth)/login');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.signInLinkText}>
                  Already have an account? <Text style={styles.signInLinkBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradientCompat>
    </SafeAreaViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 104,
    height: 104,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    padding: 12,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  appName: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: '#111111',
  },
  appNameAccent: {
    color: '#22C55E',
  },
  appTagline: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    ...IOS_TYPOGRAPHY.title2,
    color: '#111111',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    gap: 6,
    marginBottom: 14,
  },
  inputLabel: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#111111',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#111111',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inlineError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 17,
    color: '#111111',
  },
  eyeButton: {
    padding: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: '#22C55E',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  createButtonText: {
    color: '#FFFFFF',
    ...IOS_TYPOGRAPHY.headline,
  },
  signInLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  signInLinkText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
  },
  signInLinkBold: {
    color: '#22C55E',
    fontWeight: '600',
  },
});
