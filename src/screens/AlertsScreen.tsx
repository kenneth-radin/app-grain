import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Header, AlertCard } from '@/components';
import { grainApi } from '@/api';
import type { AIPrediction } from '@/api';
import { useDevices } from '@/hooks';
import { useToast } from '@/context/AppContext';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { AlertType } from '@/utils/enums';

// Type-safe wrapper components
const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;
const AnimatedView = Animated.View as React.ComponentType<any>;

interface AlertEntry {
  id: string | number;
  severity: AlertType;
  title: string;
  message: string;
  timestamp: string;
  deviceId?: string;
}

type FilterType = 'all' | AlertType;

const FILTER_CONFIG: { key: FilterType; label: string; color: string; activeBg: string }[] = [
  { key: 'all', label: 'All', color: '#22C55E', activeBg: '#22C55E' },
  { key: AlertType.Error, label: 'Critical', color: '#EF4444', activeBg: '#EF4444' },
  { key: AlertType.Warning, label: 'Warnings', color: '#F97316', activeBg: '#F97316' },
  { key: AlertType.Info, label: 'Info', color: '#3B82F6', activeBg: '#3B82F6' },
];

export default function AlertsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [aiAlerts, setAiAlerts] = useState<AlertEntry[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string | number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [warningAlerts, setWarningAlerts] = useState(true);
  const [infoAlerts, setInfoAlerts] = useState(true);
  const { showToast } = useToast();
  const { devices } = useDevices();

  const ALERT_SETTINGS_KEY = 'grain_alert_settings';

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ALERT_SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.criticalAlerts !== undefined) setCriticalAlerts(parsed.criticalAlerts);
          if (parsed.warningAlerts !== undefined) setWarningAlerts(parsed.warningAlerts);
          if (parsed.infoAlerts !== undefined) setInfoAlerts(parsed.infoAlerts);
        }
      } catch (err) {
        console.error('Failed to load alert settings:', err);
      }
    })();
  }, []);

  const persistAlertSetting = useCallback(async (key: string, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = { criticalAlerts, warningAlerts, infoAlerts, [key]: value };
    try {
      await AsyncStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(next));
      showToast('Alert setting saved', 'success');
    } catch (err) {
      showToast('Failed to save setting', 'error');
    }
  }, [criticalAlerts, warningAlerts, infoAlerts, showToast]);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await grainApi.alerts.getAll();
      const mapped = data.map((a) => ({
        id: a._id,
        severity: a.severity,
        title: a.title,
        message: a.message,
        timestamp: a.timestamp,
        deviceId: a.deviceId,
      }));
      setAlerts(mapped);
      // Mark all new alerts as unread
      setUnreadIds(new Set(mapped.map((a) => a.id)));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to fetch alerts');
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch AI predictions and convert to alerts
  const fetchAIAlerts = useCallback(async () => {
    if (!devices.length) return;
    const newAiAlerts: AlertEntry[] = [];
    await Promise.all(
      devices.map(async (device) => {
        try {
          const sensorData = await grainApi.sensors.getLatestData(device.deviceId);
          if (!sensorData) return;
          const prediction: AIPrediction = await grainApi.ai.predict({
            deviceId: device.deviceId,
            moisture: sensorData.moisture ?? 0,
            temperature: sensorData.temperature ?? 0,
            humidity: sensorData.humidity ?? 0,
            fanSpeed: sensorData.fanSpeed ?? 0,
            timeElapsed: 0,
          });
          if (prediction.recommendationType !== 'optimal') {
            const severity = prediction.recommendationType === 'critical'
              ? AlertType.Error
              : AlertType.Warning;
            newAiAlerts.push({
              id: `ai-${device.deviceId}-${Date.now()}`,
              severity,
              title: `AI: ${device.name || device.deviceId}`,
              message: prediction.recommendation,
              timestamp: new Date().toISOString(),
              deviceId: device.deviceId,
            });
          }
        } catch {
          // Silently skip devices with no sensor data or prediction
        }
      })
    );
    setAiAlerts(newAiAlerts);
    if (newAiAlerts.length > 0) {
      setUnreadIds((prev) => {
        const next = new Set(prev);
        newAiAlerts.forEach((a) => next.add(a.id));
        return next;
      });
    }
  }, [devices]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (devices.length > 0) fetchAIAlerts();
  }, [devices, fetchAIAlerts]);

  // Refresh alerts on focus
  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
      if (devices.length > 0) fetchAIAlerts();
    }, [fetchAlerts, fetchAIAlerts, devices])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  const handleAlertPress = (alert: AlertEntry) => {
    handleMarkRead(alert.id);
    if (alert.deviceId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/(app)/device/${alert.deviceId}` as const);
    }
  };

  const handleDismiss = (id: string | number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setAiAlerts((prev) => prev.filter((a) => a.id !== id));
    setUnreadIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleMarkRead = async (id: string | number) => {
    setUnreadIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    try {
      await grainApi.alerts.markRead(id);
    } catch {
      // Silently fail — local state already updated
    }
  };

  const handleMarkAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUnreadIds(new Set());
  };

  const handleClearAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await grainApi.alerts.clear();
      setAlerts([]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to clear alerts');
    }
  };

  const allAlerts = [...aiAlerts, ...alerts];
  const filteredAlerts = filter === 'all' ? allAlerts : allAlerts.filter((a) => a.severity === filter);

  return (
    <SafeAreaViewCompat style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.alerts} style={styles.gradient}>
        <Header />
        <AnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.screenTitle}>Alerts</Text>
              <Text style={styles.alertCount}>{allAlerts.length} alerts{unreadIds.size > 0 ? ` · ${unreadIds.size} unread` : ''}</Text>
            </View>
            <View style={styles.titleActions}>
              {unreadIds.size > 0 && (
                <TouchableOpacity style={styles.markReadButton} onPress={handleMarkAllRead} activeOpacity={0.7}>
                  <Text style={styles.markReadText}>Mark All Read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAll} activeOpacity={0.7}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterRow}>
            {FILTER_CONFIG.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterButton, filter === f.key && { backgroundColor: f.activeBg }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(f.key); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, filter === f.key && styles.filterActiveText]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22C55E" />
            </View>
          ) : filteredAlerts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#22C55E" />
              <Text style={styles.emptyText}>No alerts</Text>
              <Text style={styles.emptySubtext}>You're all caught up!</Text>
            </View>
          ) : (
            filteredAlerts.map((alert: any) => (
              <TouchableOpacity key={alert.id} onPress={() => handleAlertPress(alert)} activeOpacity={0.8}>
                <View style={unreadIds.has(alert.id) && styles.unreadHighlight}>
                  <AlertCard alert={alert} onDismiss={handleDismiss} />
                </View>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.card}>
            <Text style={styles.settingsTitle}>Alert Settings</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Critical Alerts</Text>
                <Text style={styles.settingDesc}>Receive critical system alerts</Text>
              </View>
              <Switch
                value={criticalAlerts}
                onValueChange={(v) => { setCriticalAlerts(v); persistAlertSetting('criticalAlerts', v); }}
                trackColor={{ false: 'rgba(0,0,0,0.08)', true: '#22C55E' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Warning Alerts</Text>
                <Text style={styles.settingDesc}>Receive warning notifications</Text>
              </View>
              <Switch
                value={warningAlerts}
                onValueChange={(v) => { setWarningAlerts(v); persistAlertSetting('warningAlerts', v); }}
                trackColor={{ false: 'rgba(0,0,0,0.08)', true: '#22C55E' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Information Updates</Text>
                <Text style={styles.settingDesc}>Receive informational updates</Text>
              </View>
              <Switch
                value={infoAlerts}
                onValueChange={(v) => { setInfoAlerts(v); persistAlertSetting('infoAlerts', v); }}
                trackColor={{ false: 'rgba(0,0,0,0.08)', true: '#22C55E' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </ScrollView>
        </AnimatedView>
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
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  screenTitle: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: '#111111',
  },
  alertCount: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markReadButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
  },
  markReadText: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
    color: '#3B82F6',
  },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    backgroundColor: '#FFFFFF',
  },
  clearAllText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#22C55E',
  },
  unreadHighlight: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
  },
  filterText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterActiveText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 8,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.title3,
    color: '#111111',
  },
  emptySubtext: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  settingsTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#111111',
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    ...IOS_TYPOGRAPHY.body,
    color: '#111111',
  },
  settingDesc: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    marginTop: 2,
  },
});
