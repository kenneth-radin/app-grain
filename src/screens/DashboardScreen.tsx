import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, createAnimatedComponent } from 'react-native-reanimated';
import { ref, onValue, off } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useDevices } from '@/hooks';
import { Header, Navigation, StatusBadge, DryingAlertBanner } from '@/components';
import { GRADIENTS, IOS_TYPOGRAPHY, DRYING } from '@/utils/constants';
import { DeviceStatus } from '@/utils/enums';
import { analyzeDryingStatus } from '@/utils/dryingAlerts';
import { triggerDryingAlertNotification } from '@/utils/pushNotifications';
import { Routes } from '@/types/navigation';
import type { Device } from '@/api';

// Type-safe wrapper components
const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;

function SkeletonDeviceCards() {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonTextBlock}>
              <View style={[styles.skeletonBar, { width: '60%' }]} />
              <View style={[styles.skeletonBar, { width: '40%', marginTop: 8 }]} />
            </View>
            <View style={styles.skeletonBadge} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { devices: apiDevices, isLoading, error, refetch } = useDevices();
  const [devices, setDevices] = useState<Device[]>(apiDevices);
  const [refreshing, setRefreshing] = useState(false);

  const dryingAlert = useMemo(() => {
    const onlineDevice = devices.find(d => d.status === DeviceStatus.Online);
    if (!onlineDevice) return null;
    return analyzeDryingStatus(
      (onlineDevice as any)?.latestMoisture ?? 20,
      DRYING.TARGET_MOISTURE,
      (onlineDevice as any)?.latestTemperature ?? 45,
    );
  }, [devices]);

  // Fire local push notification when drying alert changes to non-normal
  useEffect(() => {
    if (dryingAlert && dryingAlert.type !== 'normal') {
      const onlineDevice = devices.find(d => d.status === DeviceStatus.Online);
      triggerDryingAlertNotification(dryingAlert, onlineDevice?.deviceId);
    }
  }, [dryingAlert, devices]);

  // Sync API devices into state
  useEffect(() => {
    setDevices(apiDevices);
  }, [apiDevices]);

  // Refetch on screen focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Subscribe to Firebase realtime device statuses
  useEffect(() => {
    if (!db || apiDevices.length === 0) return

    const statusRef = ref(db, 'grain/devices')
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const firebaseDevices = snapshot.val()
      if (firebaseDevices) {
        setDevices(prev => prev.map(device => ({
          ...device,
          status: firebaseDevices[device.deviceId]?.status ?? device.status
        })))
      }
    })

    return () => off(statusRef)
  }, [apiDevices.length])

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDevicePress = (device: Device) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(app)/device/${device.deviceId}` as const);
  };

  const handleAddDevice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(Routes.AddDevice);
  };

const AnimatedView = createAnimatedComponent(View);

  return (
    <SafeAreaViewCompat style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.dashboard} style={styles.gradient}>
        <Header />
        <AnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Drying Alert Banner — uses real sensor data when available */}
            {dryingAlert && dryingAlert.type !== 'normal' && (
              <DryingAlertBanner severity={dryingAlert.severity} message={dryingAlert.message} action={dryingAlert.action} />
            )}

            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>Your Devices</Text>
              <View style={styles.titleActions}>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(Routes.Profile); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-circle-outline" size={28} color="#22C55E" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddDevice}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* AI Insights Card */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(Routes.AIPrediction); }}
              activeOpacity={0.7}
            >
              <View style={styles.aiCardLeft}>
                <View style={styles.aiIconBg}>
                  <Ionicons name="sparkles" size={22} color="#22C55E" />
                </View>
                <View style={styles.aiCardText}>
                  <Text style={styles.aiCardTitle}>AI Insights</Text>
                  <Text style={styles.aiCardSub}>View drying predictions & recommendations</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {isLoading && devices.length === 0 ? (
              <SkeletonDeviceCards />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color="#6B7280" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={refetch} style={styles.retryButton} activeOpacity={0.7}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : devices.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="hardware-chip-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No Devices Paired</Text>
                <Text style={styles.emptySubtext}>Connect your grain dryer to get started</Text>
                <TouchableOpacity
                  style={styles.addDeviceButton}
                  onPress={handleAddDevice}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.addDeviceButtonText}>Add Device</Text>
                </TouchableOpacity>
              </View>
            ) : (
              devices.map((device, index) => (
                <TouchableOpacity
                  key={device._id || device.deviceId || `device-${index}`}
                  onPress={() => handleDevicePress(device)}
                  activeOpacity={0.7}
                >
                  <View style={styles.deviceCard}>
                    <View style={styles.deviceLeft}>
                      <View style={[styles.deviceIconCircle, { backgroundColor: device.status === DeviceStatus.Online ? '#DCFCE7' : '#F3F4F6' }]}>
                        <Ionicons name="hardware-chip-outline" size={20} color={device.status === DeviceStatus.Online ? '#22C55E' : '#9CA3AF'} />
                      </View>
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName}>{device.name || device.deviceId}</Text>
                        <Text style={styles.deviceLocation}>{device.location || 'No location'}</Text>
                        <Text style={styles.deviceMeta}>{device.deviceId} · {device.status === DeviceStatus.Online ? 'Active now' : 'Offline'}</Text>
                      </View>
                    </View>
                    <StatusBadge status={device.status === DeviceStatus.Online ? DeviceStatus.Online : DeviceStatus.Offline} size="md" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </AnimatedView>

        {/* FAB - Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddDevice}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <Navigation />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 72,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: '#111111',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#111111',
  },
  deviceLocation: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    marginTop: 2,
  },
  deviceMeta: {
    ...IOS_TYPOGRAPHY.caption2,
    color: '#9CA3AF',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    ...IOS_TYPOGRAPHY.footnote,
  },
  retryButton: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
  },
  retryText: {
    color: '#FFFFFF',
    ...IOS_TYPOGRAPHY.headline,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.title3,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
  },
  emptySubtext: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    marginBottom: 16,
  },
  addDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  addDeviceButtonText: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
  skeletonContainer: {
    gap: 8,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonTextBlock: {
    flex: 1,
  },
  skeletonBar: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },
  skeletonBadge: {
    width: 64,
    height: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
  },
  dryingAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  dryingAlertContent: {
    flex: 1,
    gap: 2,
  },
  dryingAlertMsg: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
  },
  dryingAlertAction: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#6B7280',
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    marginBottom: 4,
  },
  aiCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCardText: {
    flex: 1,
    gap: 2,
  },
  aiCardTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#16A34A',
  },
  aiCardSub: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#6B7280',
  },
});
