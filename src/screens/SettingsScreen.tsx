import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks';
import { useToast } from '@/context/AppContext';
import { useDevices } from '@/hooks';
import { Header, StatusBadge } from '@/components';
import { DEFAULT_SETTINGS, GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { StorageKeys, UserRole, DeviceStatus, DryerStatus } from '@/utils/enums';
import { Routes } from '@/types/navigation';

// Type-safe wrapper components
const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;
const AnimatedView = Animated.View as React.ComponentType<any>;

const SETTINGS_KEY = 'grain_settings';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const { devices } = useDevices();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Refresh profile on focus to sync with web admin changes
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [])
  );

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  const updateSetting = useCallback(async (key: string, value: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      showToast('Setting saved', 'success');
    } catch (err) {
      showToast('Failed to save setting', 'error');
    }
  }, [settings, showToast]);

  const handleLogoutPress = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            await SecureStore.deleteItemAsync(StorageKeys.AuthToken).catch(() => {});
            router.replace('/(auth)/login');
          } catch (err) {
            console.error('Logout error:', err);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaViewCompat style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.settings} style={styles.gradient}>
        <Header />
        <AnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.screenTitle}>Settings</Text>

          {/* User Info */}
            {/* Account Section */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ACCOUNT</Text>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(Routes.Profile); }}
                activeOpacity={0.7}
              >
                <View style={styles.settingInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="person-outline" size={20} color="#6B7280" />
                    <Text style={styles.settingLabel}>My Profile</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="mail-outline" size={20} color="#6B7280" />
                    <View>
                      <Text style={styles.settingLabel}>Email</Text>
                      <Text style={styles.settingDesc}>{user?.email || 'Not set'}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
                    <View>
                      <Text style={styles.settingLabel}>Role</Text>
                      <Text style={styles.settingDesc}>{user?.role || UserRole.Farmer}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

          {/* Connected Devices */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CONNECTED DEVICES</Text>
            {devices.length === 0 ? (
              <Text style={styles.noDevices}>No devices connected</Text>
            ) : (
              devices.map((device, idx) => (
                <View key={device._id || device.deviceId || idx} style={styles.deviceRow}>
                  <View style={styles.deviceInfo}>
                    <Ionicons name="hardware-chip-outline" size={20} color={device.status === DeviceStatus.Online ? '#22C55E' : 'rgba(0,0,0,0.3)'} />
                    <View style={styles.deviceText}>
                      <Text style={styles.deviceName}>{device.name || device.deviceId}</Text>
                      <Text style={styles.deviceSub}>{device.location || 'No location'}</Text>
                    </View>
                  </View>
                  <StatusBadge status={device.status === DeviceStatus.Online ? DryerStatus.Running : DeviceStatus.Offline} size="sm" />
                </View>
              ))
            )}
          </View>

          {/* Preferences */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PREFERENCES</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Temperature Unit</Text>
                <Text style={styles.settingDesc}>Display temperature in °F or °C</Text>
              </View>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitButton, settings.temperatureUnit === 'F' && styles.unitActive]}
                  onPress={() => updateSetting('temperatureUnit', 'F')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitText, settings.temperatureUnit === 'F' && styles.unitActiveText]}>°F</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitButton, settings.temperatureUnit === 'C' && styles.unitActive]}
                  onPress={() => updateSetting('temperatureUnit', 'C')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitText, settings.temperatureUnit === 'C' && styles.unitActiveText]}>°C</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Notifications</Text>
                <Text style={styles.settingDesc}>Enable push notifications</Text>
              </View>
              <Switch
                value={settings.notifications}
                onValueChange={(v) => updateSetting('notifications', v)}
                trackColor={{ false: 'rgba(0,0,0,0.08)', true: '#22C55E' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto Start</Text>
                <Text style={styles.settingDesc}>Automatically start dryer at scheduled time</Text>
              </View>
              <Switch
                value={settings.autoStart}
                onValueChange={(v) => updateSetting('autoStart', v)}
                trackColor={{ false: 'rgba(0,0,0,0.08)', true: '#22C55E' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Maintenance Reminder</Text>
                <Text style={styles.settingDesc}>Get reminders for scheduled maintenance</Text>
              </View>
              <Switch
                value={settings.maintenanceReminder}
                onValueChange={(v) => updateSetting('maintenanceReminder', v)}
                trackColor={{ false: 'rgba(0,0,0,0.08)', true: '#22C55E' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <View style={styles.versionRow}>
            <Text style={styles.versionText}>grAIn v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
        </ScrollView>
        </AnimatedView>
      </LinearGradientCompat>
    </SafeAreaViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 72, gap: 12 },
  screenTitle: { ...IOS_TYPOGRAPHY.largeTitle, color: '#111111' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardLabel: { ...IOS_TYPOGRAPHY.caption2, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { ...IOS_TYPOGRAPHY.headline, color: '#111111' },
  userEmail: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280', marginTop: 2 },
  noDevices: { ...IOS_TYPOGRAPHY.footnote, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceText: { flex: 1 },
  deviceName: { ...IOS_TYPOGRAPHY.body, color: '#111111' },
  deviceSub: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280', marginTop: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { ...IOS_TYPOGRAPHY.body, color: '#111111' },
  settingDesc: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280', marginTop: 2 },
  unitToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 50, padding: 2 },
  unitButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50 },
  unitActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  unitText: { ...IOS_TYPOGRAPHY.callout, fontWeight: '600', color: '#9CA3AF' },
  unitActiveText: { color: '#22C55E' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: 50, paddingVertical: 16, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  logoutButtonText: { color: '#FFFFFF', ...IOS_TYPOGRAPHY.headline },
  versionRow: { alignItems: 'center', paddingVertical: 16 },
  versionText: { ...IOS_TYPOGRAPHY.caption1, color: '#9CA3AF' },
});
