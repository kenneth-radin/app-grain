import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks';
import { grainApi } from '@/api';
import { useRouter } from 'expo-router';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { DeviceStatus } from '@/utils/enums';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function LoginScreen() {
  const { login, error, clearError, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);

  useEffect(() => {
    checkServerHealth();
  }, []);

  useEffect(() => {
    if (error) clearError();
    setEmailError('');
    setPasswordError('');
  }, [email, password]);

  const checkServerHealth = async () => {
    const RETRY_DELAYS = [2000, 4000, 8000];
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const isHealthy = await grainApi.health.check(10000); // 10s timeout for quick ping
        if (isHealthy) {
          setServerStatus('online');
          return;
        }
      } catch {
        // network error, retry
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
    setServerStatus('offline');
  };

  const handleLogin = async () => {
    let valid = true;
    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('Email is required');
      valid = false;
    } else if (!isValidEmail(email.trim())) {
      setEmailError('Enter a valid email address');
      valid = false;
    }
    if (!password.trim()) {
      setPasswordError('Password is required');
      valid = false;
    } else if (password.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters');
      valid = false;
    }
    if (!valid) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(email.trim(), password.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)/dashboard');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.message || 'Invalid credentials';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('user')) {
        setEmailError(msg);
      } else if (msg.toLowerCase().includes('password')) {
        setPasswordError(msg);
      } else {
        setEmailError(msg);
      }
    }
  };

  const handleDemoLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login('admin@grain.com', 'admin123');
      router.replace('/(app)/dashboard');
    } catch (err: any) {
      Alert.alert('Demo Login Failed', 'Demo account not available');
    }
  };

  const serverStatusColor = serverStatus === DeviceStatus.Online ? '#22C55E' : serverStatus === DeviceStatus.Offline ? '#EF4444' : '#FBBF24';
  const serverStatusText = serverStatus === 'checking' ? 'Checking...' : serverStatus === DeviceStatus.Online ? 'Online' : 'Offline';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradient colors={GRADIENTS.login} style={styles.gradient}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
              <Text style={styles.cardTitle}>Login to Your Account</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  ref={emailRef}
                  style={[styles.input, emailError ? styles.inputError : null]}
                  value={email}
                  onChangeText={setEmail}
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
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
              </View>

              <TouchableOpacity onPress={() => Alert.alert('Forgot Password', 'Password reset is not yet available. Please contact support.')} style={styles.forgotLink} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {error && !emailError && !passwordError ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.signInButtonText}>Signing in…</Text>
                  </View>
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.createAccountButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(auth)/signup');
                }}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.createAccountButtonText}>Create an Account</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.demoRow}
              onPress={handleDemoLogin}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle-outline" size={18} color="#22C55E" />
              <Text style={styles.demoText}>try demo account to explore</Text>
            </TouchableOpacity>

            <View style={styles.serverRow}>
              <View style={[styles.serverDot, { backgroundColor: serverStatusColor }]} />
              <Text style={styles.serverText}>Server {serverStatusText}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
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
    paddingVertical: 24,
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
    marginBottom: 16,
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
  },
  forgotText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#22C55E',
    fontWeight: '600',
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
  signInButton: {
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
  signInButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  signInButtonText: {
    color: '#FFFFFF',
    ...IOS_TYPOGRAPHY.headline,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#9CA3AF',
  },
  createAccountButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#22C55E',
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createAccountButtonText: {
    color: '#22C55E',
    ...IOS_TYPOGRAPHY.headline,
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  demoText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#22C55E',
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  serverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serverText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#9CA3AF',
  },
});
