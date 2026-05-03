import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Header, Navigation, ModeToggle, CustomSlider, StatusBadge } from '@/components';
import { grainApi, isNetworkError } from '@/api';
import type { Device } from '@/api';
import { getDatabase, ref, set } from 'firebase/database';
import { useDevices } from '@/hooks';
import { useRealtimeSensor } from '@/hooks';
import { useAppContext } from '@/context/AppContext';
import { useAIPrediction, runPrediction } from '@/hooks/useAIPrediction';
import type { SensorInput, AIPrediction } from '@/hooks/useAIPrediction';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';
import { DryerMode, DryerStatus, StorageKeys } from '@/utils/enums';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueCommand } from '@/utils/commandQueue';

// Persisted state keys for ControlScreen so state survives tab switches
const PERSIST_KEYS = {
  selectedDeviceId: 'control_selectedDeviceId',
  mode: 'control_mode',
  isRunning: 'control_isRunning',
  temperature: 'control_temperature',
  fanSpeed: 'control_fanSpeed',
  fan1Status: 'control_fan1Status',
  fan2Status: 'control_fan2Status',
};

export default function ControlScreen() {
  const { showToast } = useAppContext();
  const { devices, isLoading: devicesLoading } = useDevices();
  const { isServerOnline, queuedCommandCount } = useAppContext();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [mode, setMode] = useState<DryerMode>(DryerMode.Auto);
  const [isRunning, setIsRunning] = useState(false);
  const [temperature, setTemperature] = useState(55);
  const [fanSpeed, setFanSpeed] = useState(75);
  const [isControlling, setIsControlling] = useState(false);
  const [aiAutoStopped, setAiAutoStopped] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fan1Status, setFan1Status] = useState<'ON' | 'OFF'>('OFF');
  const [fan2Status, setFan2Status] = useState<'ON' | 'OFF'>('OFF');
  const [fan1Loading, setFan1Loading] = useState(false);
  const [fan2Loading, setFan2Loading] = useState(false);
  const [bothLoading, setBothLoading] = useState(false);
  const [syncingUntil, setSyncingUntil] = useState<number | null>(null);
  const [commandAck, setCommandAck] = useState(false);
  const [commandTimeout, setCommandTimeout] = useState(false);
  const [restored, setRestored] = useState(false);

  // Restore persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.multiGet(Object.values(PERSIST_KEYS));
        const map = Object.fromEntries(saved);
        if (map[PERSIST_KEYS.mode]) setMode(map[PERSIST_KEYS.mode] as DryerMode);
        if (map[PERSIST_KEYS.isRunning] === 'true') setIsRunning(true);
        if (map[PERSIST_KEYS.temperature]) setTemperature(parseFloat(map[PERSIST_KEYS.temperature]));
        if (map[PERSIST_KEYS.fanSpeed]) setFanSpeed(parseInt(map[PERSIST_KEYS.fanSpeed], 10));
        if (map[PERSIST_KEYS.fan1Status]) setFan1Status(map[PERSIST_KEYS.fan1Status] as 'ON' | 'OFF');
        if (map[PERSIST_KEYS.fan2Status]) setFan2Status(map[PERSIST_KEYS.fan2Status] as 'ON' | 'OFF');
        if (map[PERSIST_KEYS.selectedDeviceId]) {
          // Will be applied after devices load
          setPendingDeviceId(map[PERSIST_KEYS.selectedDeviceId]);
        }
      } catch {}
      setRestored(true);
    })();
  }, []);

  // Persist state on change
  useEffect(() => {
    if (!restored) return;
    AsyncStorage.multiSet([
      [PERSIST_KEYS.mode, mode],
      [PERSIST_KEYS.isRunning, String(isRunning)],
      [PERSIST_KEYS.temperature, String(temperature)],
      [PERSIST_KEYS.fanSpeed, String(fanSpeed)],
      [PERSIST_KEYS.fan1Status, fan1Status],
      [PERSIST_KEYS.fan2Status, fan2Status],
      [PERSIST_KEYS.selectedDeviceId, selectedDevice?.deviceId || ''],
    ]).catch(() => {});
  }, [restored, mode, isRunning, temperature, fanSpeed, fan1Status, fan2Status, selectedDevice]);

  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);

  const deviceId = selectedDevice?.deviceId;

  const { commandAcknowledged } = useRealtimeSensor(deviceId);

  // When Firebase acknowledges the command, show green check
  useEffect(() => {
    if (commandAcknowledged && syncingUntil !== null) {
      setCommandAck(true);
      setCommandTimeout(false);
      setSyncingUntil(null);
      const timer = setTimeout(() => setCommandAck(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [commandAcknowledged]);

  // 30s timeout: if no acknowledgement, show "Device not responding"
  useEffect(() => {
    if (syncingUntil !== null) {
      const remaining = syncingUntil - Date.now();
      const timeoutMs = Math.max(remaining, 30000);
      const timer = setTimeout(() => {
        if (!commandAck) {
          setCommandTimeout(true);
          setSyncingUntil(null);
          setTimeout(() => setCommandTimeout(false), 5000);
        }
      }, timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [syncingUntil]);

  const handleFanControl = async (fan: 'FAN1' | 'FAN2' | 'ALL', action: 'ON' | 'OFF') => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const prevFan1 = fan1Status;
    const prevFan2 = fan2Status;

    if (fan === 'FAN1' || fan === 'ALL') setFan1Status(action);
    if (fan === 'FAN2' || fan === 'ALL') setFan2Status(action);
    if (fan === 'FAN1') setFan1Loading(true);
    if (fan === 'FAN2') setFan2Loading(true);
    if (fan === 'ALL') setBothLoading(true);

    try {
      await grainApi.dryer.controlFan(deviceId, fan, action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const label = fan === 'ALL' ? 's' : fan === 'FAN1' ? '1' : '2';
      showToast(`Fan ${label} turned ${action.toLowerCase()}`, 'success');
      // Show syncing indicator for 15 seconds while Firebase catches up
      setSyncingUntil(Date.now() + 15000);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to control fan. Try again.', 'error');
      setFan1Status(prevFan1);
      setFan2Status(prevFan2);
    } finally {
      setFan1Loading(false);
      setFan2Loading(false);
      setBothLoading(false);
    }
  };

  useEffect(() => {
    if (devices.length > 0) {
      if (pendingDeviceId) {
        const found = devices.find(d => d.deviceId === pendingDeviceId);
        if (found) {
          setSelectedDevice(found);
          setPendingDeviceId(null);
        }
      } else if (!selectedDevice) {
        setSelectedDevice(devices[0]);
      }
    }
  }, [devices, selectedDevice, pendingDeviceId]);

  // AI prediction polling in AUTO mode when running
  useEffect(() => {
    if (mode !== DryerMode.Auto || !isRunning || !deviceId) return;

    const fetchAIPrediction = async () => {
      setAiLoading(true);
      try {
        const latest = await grainApi.sensors.getLatestData(deviceId);
        const input: SensorInput = {
          deviceId,
          temperature: latest?.temperature ?? 65.5,
          humidity: latest?.humidity ?? 50,
          moisture: latest?.moisture ?? 20,
          fanSpeed: latest?.fanSpeed ?? 75,
          timeElapsed: 60,
        };
        try {
          const result = await grainApi.ai.predict(input);
          setAiPrediction({
            predictedMoisture30min: result.predictedMoisture30min,
            estimatedMinutesToTarget: result.estimatedMinutesToTarget,
            recommendation: result.recommendation,
            recommendationType: result.recommendationType,
            efficiencyScore: result.efficiencyScore,
            confidence: result.confidence,
            isDryingComplete: result.isDryingComplete,
            projectedMoistureCurve: result.projectedCurve,
            targetMoisture: result.targetMoisture,
            algorithm: result.algorithm,
          });
          // Auto-stop if drying complete
          if (result.isDryingComplete && !aiAutoStopped) {
            setAiAutoStopped(true);
            try {
              await grainApi.dryer.stop(deviceId);
              setIsRunning(false);
              Alert.alert('Drying Complete', 'Drying complete — dryer stopped by AI');
            } catch (err: any) {
              console.error('AI auto-stop failed:', err);
            }
          }
        } catch {
          const result = runPrediction(input);
          setAiPrediction(result);
          if (result.isDryingComplete && !aiAutoStopped) {
            setAiAutoStopped(true);
            try {
              await grainApi.dryer.stop(deviceId);
              setIsRunning(false);
              Alert.alert('Drying Complete', 'Drying complete — dryer stopped by AI');
            } catch (err: any) {
              console.error('AI auto-stop failed:', err);
            }
          }
        }
      } catch {
        // Sensor fetch failed
      } finally {
        setAiLoading(false);
      }
    };

    fetchAIPrediction();
    const interval = setInterval(fetchAIPrediction, 60000);
    return () => clearInterval(interval);
  }, [mode, isRunning, deviceId, aiAutoStopped]);

  const handleStopDryer = async () => {
    if (!deviceId) {
      Alert.alert('No Device', 'Please select a device first.');
      return;
    }
    Alert.alert('Stop Dryer', 'Are you sure you want to stop the dryer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setIsControlling(true);
          // Optimistic UI: update immediately
          setIsRunning(false);
          setSyncingUntil(Date.now() + 15000);
          try {
            await grainApi.dryer.stop(deviceId);
            // Dual-write: REST for persistence, Firebase for speed
            try {
              const db = getDatabase();
              await set(ref(db, `grain/commands/${deviceId}/pending/latest`), {
                command: 'STOP',
                timestamp: Date.now()
              });
            } catch (fbErr) { console.warn('[Firebase] Dual-write stop failed:', fbErr); }
            showToast('Dryer stopped successfully', 'success');
          } catch (err: any) {
            // Revert on failure
            setIsRunning(true);
            if (isNetworkError(err)) {
              await enqueueCommand({ id: `${Date.now()}-stop`, deviceId: deviceId!, type: 'stop', payload: {}, queuedAt: Date.now() });
              showToast('Offline — stop command queued', 'warning');
            } else {
              Alert.alert('Error', err?.message || 'Failed to stop dryer');
              showToast(err?.message || 'Failed to stop dryer', 'error');
            }
          } finally {
            setIsControlling(false);
          }
        },
      },
    ]);
  };

  const handleStartDryer = async () => {
    if (!deviceId) {
      Alert.alert('No Device', 'Please select a device first.');
      return;
    }
    const deviceName = selectedDevice?.name || deviceId;
    Alert.alert(
      'Start Dryer',
      `Start drying cycle?\n\nDevice: ${deviceName}\nMode: ${mode === DryerMode.Auto ? 'AI Auto' : 'Manual'}\n${mode === DryerMode.Manual ? `Temp: ${temperature.toFixed(1)}°C\nFan: ${fanSpeed}%` : 'AI will adjust settings automatically'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          style: 'default',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsControlling(true);
            // Optimistic UI: update immediately
            setIsRunning(true);
            setAiAutoStopped(false);
            setSyncingUntil(Date.now() + 15000);
            try {
              await grainApi.dryer.start(deviceId, mode, temperature, fanSpeed);
              // Dual-write: REST for persistence, Firebase for speed
              try {
                const db = getDatabase();
                await set(ref(db, `grain/commands/${deviceId}/pending/latest`), {
                  command: 'START', mode, temperature, fanSpeed,
                  timestamp: Date.now()
                });
              } catch (fbErr) { console.warn('[Firebase] Dual-write start failed:', fbErr); }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showToast('Dryer started successfully', 'success');
            } catch (err: any) {
              // Revert on failure
              setIsRunning(false);
              if (isNetworkError(err)) {
                await enqueueCommand({ id: `${Date.now()}-start`, deviceId: deviceId!, type: 'start', payload: { mode, temperature, fanSpeed }, queuedAt: Date.now() });
                showToast('Offline — start command queued', 'warning');
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                showToast(err?.message || 'Failed to start dryer', 'error');
              }
            } finally {
              setIsControlling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradient colors={GRADIENTS.control} style={styles.gradient}>
        <Header />
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.screenTitle}>Control System</Text>
              <Text style={styles.screenSubtitle}>Manage dryer settings and operation</Text>
            </View>
            <StatusBadge status={isRunning ? DryerStatus.Running : DryerStatus.Idle} size="md" />
          </View>

          {/* Command Acknowledgement Banner */}
          {commandAck ? (
            <View style={styles.syncBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={styles.syncBannerText}>Command received by device</Text>
            </View>
          ) : commandTimeout ? (
            <View style={[styles.syncBanner, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
              <Text style={[styles.syncBannerText, { color: '#EF4444' }]}>Device not responding</Text>
            </View>
          ) : syncingUntil !== null && Date.now() < syncingUntil && (
            <View style={styles.syncBanner}>
              <ActivityIndicator size="small" color="#22C55E" />
              <Text style={styles.syncBannerText}>Syncing with device...</Text>
            </View>
          )}

          {/* Offline / Queued Command Banner */}
          {!isServerOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color="#F97316" />
              <Text style={styles.offlineBannerText}>
                Offline{queuedCommandCount > 0 ? ` — ${queuedCommandCount} command${queuedCommandCount > 1 ? 's' : ''} queued` : ' — commands will be queued'}
              </Text>
            </View>
          )}

          {/* Device Selector */}
          {devices.length > 1 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>SELECT DEVICE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceScroll}>
                {devices.map((device) => (
                  <TouchableOpacity
                    key={device._id || device.deviceId}
                    style={[
                      styles.deviceChip,
                      selectedDevice?.deviceId === device.deviceId && styles.deviceChipActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDevice(device);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.deviceChipText,
                        selectedDevice?.deviceId === device.deviceId && styles.deviceChipTextActive,
                      ]}
                    >
                      {device.name || device.deviceId}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {devicesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22C55E" />
              <Text style={styles.loadingText}>Loading devices...</Text>
            </View>
          ) : !deviceId ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="hardware-chip-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No devices available</Text>
              <Text style={styles.emptySubtext}>Add a device from the Dashboard first</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>SYSTEM STATUS</Text>
                <View style={styles.statusRow}>
                  <Ionicons name="ellipse" size={12} color={isRunning ? '#22C55E' : '#9CA3AF'} />
                  <Text style={isRunning ? styles.statusTextGreen : styles.statusTextGray}>
                    {isRunning ? 'Running' : 'Idle'}
                  </Text>
                </View>
                {selectedDevice && (
                  <Text style={styles.deviceLabel}>
                    Device: {selectedDevice.name || selectedDevice.deviceId}
                  </Text>
                )}

                {isRunning ? (
                  <TouchableOpacity
                    style={[styles.stopButton, isControlling && styles.buttonDisabled]}
                    onPress={handleStopDryer}
                    disabled={isControlling}
                    activeOpacity={0.7}
                  >
                    {isControlling ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="stop" size={20} color="#FFFFFF" />
                        <Text style={styles.stopButtonText}>Stop Dryer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.startButton, isControlling && styles.buttonDisabled]}
                    onPress={handleStartDryer}
                    disabled={isControlling}
                    activeOpacity={0.7}
                  >
                    {isControlling ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="play" size={20} color="#FFFFFF" />
                        <Text style={styles.startButtonText}>Start Dryer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <Text style={[styles.cardLabel, { marginTop: 24 }]}>OPERATING MODE</Text>
                <ModeToggle mode={mode} onModeChange={(m: string) => setMode(m as DryerMode)} />
              </View>

              {/* AI Auto Mode Banner */}
              {mode === DryerMode.Auto && isRunning && (
                <View style={styles.aiCard}>
                  <View style={styles.aiCardHeader}>
                    <View style={styles.aiActiveBadge}>
                      <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                    </View>
                    <Text style={styles.aiCardTitle}>AI is controlling the dryer</Text>
                  </View>
                  <Text style={styles.aiCardSubtext}>AI automatically adjusts fan speed and temperature for optimal drying</Text>
                  {aiPrediction && (
                    <>
                      <View style={styles.aiRecRow}>
                        <Ionicons
                          name={aiPrediction.recommendationType === 'optimal' ? 'checkmark-circle' : aiPrediction.recommendationType === 'warning' ? 'warning' : 'alert-circle'}
                          size={16}
                          color={aiPrediction.recommendationType === 'optimal' ? '#22C55E' : aiPrediction.recommendationType === 'warning' ? '#F59E0B' : '#EF4444'}
                        />
                        <Text style={[styles.aiRecText, { color: aiPrediction.recommendationType === 'optimal' ? '#16A34A' : aiPrediction.recommendationType === 'warning' ? '#D97706' : '#DC2626' }]}>
                          {aiPrediction.recommendation}
                        </Text>
                      </View>
                      {!aiPrediction.isDryingComplete && (
                        <Text style={styles.aiEstText}>
                          Est. completion: {Math.floor(aiPrediction.estimatedMinutesToTarget / 60)}h {aiPrediction.estimatedMinutesToTarget % 60}m
                        </Text>
                      )}
                    </>
                  )}
                  {aiLoading && <ActivityIndicator size="small" color="#22C55E" style={{ marginTop: 4 }} />}
                  {aiAutoStopped && (
                    <View style={styles.aiStoppedBanner}>
                      <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                      <Text style={styles.aiStoppedText}>Auto-stopped by AI — target moisture reached</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Manual sliders — disabled in auto mode */}
              <View style={[styles.card, mode === DryerMode.Auto && styles.cardDisabled]}>
                <Text style={styles.cardLabel}>ADVANCED SETTINGS</Text>
                {mode === DryerMode.Auto && (
                  <View style={styles.disabledOverlay}>
                    <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.disabledText}>Manual control disabled in Auto mode</Text>
                  </View>
                )}
                <View style={[styles.sliderSection, mode === DryerMode.Auto && styles.sliderDisabled]}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.sliderLabel}>Temperature</Text>
                    <Text style={styles.sliderValue}>{temperature.toFixed(1)} °C</Text>
                  </View>
                  <CustomSlider
                    label=""
                    value={temperature}
                    minimumValue={30}
                    maximumValue={70}
                    step={0.5}
                    unit=" °C"
                    onValueChange={setTemperature}
                  />
                </View>

                <View style={[styles.sliderSection, mode === DryerMode.Auto && styles.sliderDisabled]}>
                  <View style={styles.sliderHeader}>
                    <Text style={styles.sliderLabel}>Fan Speed</Text>
                    <Text style={styles.sliderValue}>{fanSpeed} %</Text>
                  </View>
                  <CustomSlider
                    label=""
                    value={fanSpeed}
                    minimumValue={0}
                    maximumValue={100}
                    step={5}
                    unit=" %"
                    onValueChange={setFanSpeed}
                  />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>QUICK PRESETS</Text>
                <View style={styles.presetsRow}>
                  <TouchableOpacity
                    style={[styles.presetButton, styles.presetHigh]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTemperature(90); setFanSpeed(100); setMode(DryerMode.Manual); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="flame-outline" size={18} color="#EF4444" />
                    <Text style={styles.presetHighText}>High Speed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetButton, styles.presetMedium]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTemperature(65); setFanSpeed(60); setMode(DryerMode.Manual); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="settings-outline" size={18} color="#D97706" />
                    <Text style={styles.presetMediumText}>Medium Speed</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Fan Control — only in Manual mode */}
              {mode === DryerMode.Manual ? (
                <View style={styles.card}>
                  <View style={styles.fanControlHeader}>
                    <Ionicons name="aperture-outline" size={18} color="#6B7280" />
                    <Text style={styles.cardLabel}>FAN CONTROL</Text>
                  </View>

                  {/* Fan 1 */}
                  <View style={styles.fanRow}>
                    <View style={styles.fanLabelRow}>
                      <Ionicons name="aperture-outline" size={16} color={fan1Status === 'ON' ? '#22C55E' : '#9CA3AF'} />
                      <Text style={styles.fanLabel}>Fan 1</Text>
                      <View style={styles.fanStatusRow}>
                        <View style={[styles.fanDot, fan1Status === 'ON' ? styles.fanDotOn : styles.fanDotOff]} />
                        <Text style={[styles.fanStatusText, fan1Status === 'ON' ? styles.fanStatusOn : styles.fanStatusOff]}>
                          {fan1Status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.fanButtonsRow}>
                      <TouchableOpacity
                        style={[styles.fanButton, fan1Status === 'ON' && styles.fanButtonOnActive, (fan1Loading || bothLoading) && styles.buttonDisabled]}
                        onPress={() => handleFanControl('FAN1', 'ON')}
                        disabled={fan1Loading || bothLoading}
                        activeOpacity={0.7}
                      >
                        {fan1Loading && fan1Status === 'ON' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.fanButtonText, fan1Status === 'ON' && styles.fanButtonTextActive]}>ON</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.fanButton, fan1Status === 'OFF' && styles.fanButtonOffActive, (fan1Loading || bothLoading) && styles.buttonDisabled]}
                        onPress={() => handleFanControl('FAN1', 'OFF')}
                        disabled={fan1Loading || bothLoading}
                        activeOpacity={0.7}
                      >
                        {fan1Loading && fan1Status === 'OFF' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.fanButtonText, fan1Status === 'OFF' && styles.fanButtonTextActive]}>OFF</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Fan 2 */}
                  <View style={styles.fanRow}>
                    <View style={styles.fanLabelRow}>
                      <Ionicons name="aperture-outline" size={16} color={fan2Status === 'ON' ? '#22C55E' : '#9CA3AF'} />
                      <Text style={styles.fanLabel}>Fan 2</Text>
                      <View style={styles.fanStatusRow}>
                        <View style={[styles.fanDot, fan2Status === 'ON' ? styles.fanDotOn : styles.fanDotOff]} />
                        <Text style={[styles.fanStatusText, fan2Status === 'ON' ? styles.fanStatusOn : styles.fanStatusOff]}>
                          {fan2Status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.fanButtonsRow}>
                      <TouchableOpacity
                        style={[styles.fanButton, fan2Status === 'ON' && styles.fanButtonOnActive, (fan2Loading || bothLoading) && styles.buttonDisabled]}
                        onPress={() => handleFanControl('FAN2', 'ON')}
                        disabled={fan2Loading || bothLoading}
                        activeOpacity={0.7}
                      >
                        {fan2Loading && fan2Status === 'ON' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.fanButtonText, fan2Status === 'ON' && styles.fanButtonTextActive]}>ON</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.fanButton, fan2Status === 'OFF' && styles.fanButtonOffActive, (fan2Loading || bothLoading) && styles.buttonDisabled]}
                        onPress={() => handleFanControl('FAN2', 'OFF')}
                        disabled={fan2Loading || bothLoading}
                        activeOpacity={0.7}
                      >
                        {fan2Loading && fan2Status === 'OFF' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.fanButtonText, fan2Status === 'OFF' && styles.fanButtonTextActive]}>OFF</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Both Fans */}
                  <View style={styles.fanBothRow}>
                    <TouchableOpacity
                      style={[styles.fanBothButton, styles.fanBothOn, bothLoading && styles.buttonDisabled]}
                      onPress={() => handleFanControl('ALL', 'ON')}
                      disabled={fan1Loading || fan2Loading || bothLoading}
                      activeOpacity={0.7}
                    >
                      {bothLoading && fan1Status === 'ON' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.fanBothButtonText}>Turn Both ON</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.fanBothButton, styles.fanBothOff, bothLoading && styles.buttonDisabled]}
                      onPress={() => handleFanControl('ALL', 'OFF')}
                      disabled={fan1Loading || fan2Loading || bothLoading}
                      activeOpacity={0.7}
                    >
                      {bothLoading && fan1Status === 'OFF' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.fanBothOffButtonText}>Turn Both OFF</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  <View style={styles.disabledOverlay}>
                    <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.disabledText}>Fan control is managed automatically in AUTO mode</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
        </Animated.View>
        <Navigation />
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
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  syncBannerText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#22C55E',
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  offlineBannerText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#F97316',
    fontWeight: '600',
  },
  screenTitle: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: '#111111',
  },
  screenSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    marginTop: 2,
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
  cardLabel: {
    ...IOS_TYPOGRAPHY.caption2,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  deviceScroll: {
    flexDirection: 'row',
  },
  deviceChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  deviceChipActive: {
    backgroundColor: '#22C55E',
  },
  deviceChipText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#6B7280',
  },
  deviceChipTextActive: {
    color: '#FFFFFF',
  },
  deviceLabel: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusTextGreen: {
    ...IOS_TYPOGRAPHY.title1,
    color: '#22C55E',
  },
  statusTextGray: {
    ...IOS_TYPOGRAPHY.title1,
    color: '#9CA3AF',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: 50,
    paddingVertical: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stopButtonText: {
    color: '#FFFFFF',
    ...IOS_TYPOGRAPHY.headline,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 50,
    paddingVertical: 12,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: '#FFFFFF',
    ...IOS_TYPOGRAPHY.headline,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  sliderSection: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '500',
    color: '#111111',
  },
  sliderValue: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: '#22C55E',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  presetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 50,
  },
  presetHigh: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  presetHighText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: '#EF4444',
  },
  presetMedium: {
    backgroundColor: 'rgba(217,119,6,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.2)',
  },
  presetMediumText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: '#D97706',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.title3,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
  },
  emptySubtext: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
  },
  aiCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    gap: 6,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiActiveBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCardTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: '#16A34A',
  },
  aiCardSubtext: {
    ...IOS_TYPOGRAPHY.footnote,
    color: '#6B7280',
  },
  aiRecRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  aiRecText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '500',
    flex: 1,
  },
  aiEstText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#6B7280',
    marginTop: 2,
  },
  aiStoppedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 4,
  },
  aiStoppedText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#16A34A',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  disabledOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  disabledText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  sliderDisabled: {
    opacity: 0.4,
    pointerEvents: 'none',
  },
  fanControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  fanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  fanLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  fanLabel: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '500',
    color: '#111111',
  },
  fanStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fanDotOn: {
    backgroundColor: '#22C55E',
  },
  fanDotOff: {
    backgroundColor: '#9CA3AF',
  },
  fanStatusText: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
  },
  fanStatusOn: {
    color: '#22C55E',
  },
  fanStatusOff: {
    color: '#9CA3AF',
  },
  fanButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fanButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanButtonOnActive: {
    backgroundColor: '#22C55E',
  },
  fanButtonOffActive: {
    backgroundColor: '#EF4444',
  },
  fanButtonText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: '#6B7280',
  },
  fanButtonTextActive: {
    color: '#FFFFFF',
  },
  fanBothRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  fanBothButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanBothOn: {
    backgroundColor: '#22C55E',
  },
  fanBothOff: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  fanBothButtonText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fanBothOffButtonText: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '600',
    color: '#EF4444',
  },
});
