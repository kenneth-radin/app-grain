import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { grainApi } from '@/api';
import { useAppContext } from '@/context/AppContext';
import { Header } from '@/components';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';

export default function AddDeviceScreen() {
  const router = useRouter();
  const { showToast } = useAppContext();
  const [deviceId, setDeviceId] = useState('');
  const [location, setLocation] = useState('');
  const [deviceIdError, setDeviceIdError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedId = deviceId.trim();
    const trimmedLocation = location.trim();
    setDeviceIdError('');
    setLocationError('');

    let valid = true;
    if (!trimmedId) { setDeviceIdError('Device ID is required'); valid = false; }
    else if (trimmedId.length < 3) { setDeviceIdError('Device ID must be at least 3 characters'); valid = false; }
    if (!trimmedLocation) { setLocationError('Location is required'); valid = false; }
    if (!valid) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    try {
      await grainApi.devices.register(trimmedId.toUpperCase(), trimmedLocation);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Device added successfully', 'success');
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || '';
      if (status === 409) {
        setDeviceIdError('This device is already registered');
      } else if (status === 403) {
        setDeviceIdError('You do not have permission to add this device');
      } else {
        showToast(msg || 'Could not register device. Please try again.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradient colors={GRADIENTS.dashboard} style={styles.gradient}>
        <Header showBack onBack={() => router.back()} />
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="hardware-chip-outline" size={40} color="#22C55E" />
          </View>

          <Text style={styles.title}>Connect Your Dryer</Text>
          <Text style={styles.subtitle}>
            Enter the Device ID printed on your grain dryer unit and assign it a location.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Device ID</Text>
            <View style={[styles.inputWrapper, deviceIdError && styles.inputError]}>
              <View style={styles.inputIcon}><Ionicons name="barcode-outline" size={20} color="#9CA3AF" /></View>
              <TextInput
                style={styles.input}
                placeholder="e.g. GR-001"
                placeholderTextColor="#9CA3AF"
                value={deviceId}
                onChangeText={(t) => { setDeviceId(t); setDeviceIdError(''); }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </View>
            {deviceIdError ? <Text style={styles.inlineError}>{deviceIdError}</Text> : null}

            <Text style={[styles.label, { marginTop: 16 }]}>Location / Farm Name</Text>
            <View style={[styles.inputWrapper, locationError && styles.inputError]}>
              <View style={styles.inputIcon}><Ionicons name="location-outline" size={20} color="#9CA3AF" /></View>
              <TextInput
                style={styles.input}
                placeholder="e.g. Farm A, Plot 1"
                placeholderTextColor="#9CA3AF"
                value={location}
                onChangeText={(t) => { setLocation(t); setLocationError(''); }}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </View>
            {locationError ? <Text style={styles.inlineError}>{locationError}</Text> : null}

            <TouchableOpacity
              style={[styles.connectButton, isSubmitting && styles.connectButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.7}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="link-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.connectButtonText}>Connect Device</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: '#111111',
    marginBottom: 8,
  },
  subtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
    maxWidth: 280,
  },
  form: {
    width: '100%',
  },
  label: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inlineError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    ...IOS_TYPOGRAPHY.body,
    color: '#111111',
    paddingVertical: 0,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 50,
    height: 52,
    marginTop: 32,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  connectButtonDisabled: {
    opacity: 0.7,
  },
  connectButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
});
