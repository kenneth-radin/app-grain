import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useDevice, useRealtimeSensor, useSensorData } from '@/hooks';
import { StatusBadge, Header, GrainDryingSimulation, ProgressBar, DryingAlertBanner } from '@/components';
import { grainApi, isNetworkError } from '@/api';
import { useToast } from '@/context/AppContext';
import { GRADIENTS, IOS_TYPOGRAPHY, DRYING } from '@/utils/constants';
import { DeviceStatus, DryerStatus, DryerMode } from '@/utils/enums';
import { analyzeDryingStatus } from '@/utils/dryingAlerts';
import { triggerDryingAlertNotification } from '@/utils/pushNotifications';
import { getGreeting, formatTimeAgo } from '@/utils/formatters';
import { Routes } from '@/types/navigation';
import { enqueueCommand } from '@/utils/commandQueue';

// Type-safe wrapper components
const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;
const AnimatedView = Animated.View as React.ComponentType<any>;

interface DeviceDetailScreenProps { deviceId?: string; }

export default function DeviceDetailScreen({ deviceId }: DeviceDetailScreenProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { device, isLoading: deviceLoading, error: deviceError, refetch: deviceRefetch } = useDevice(deviceId);
  const { sensorData: rtData, isOnline: rtOnline, isFallbackMode, lastUpdated, remoteCommand } = useRealtimeSensor(device?.deviceId);

  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  // Show toast + command status when a remote command is detected (e.g. from web admin)
  useEffect(() => {
    if (remoteCommand) {
      let label = '';
      if (remoteCommand === 'started' || remoteCommand === 'start') {
        showToast('Dryer started remotely', 'info');
        label = 'Start command received';
      } else if (remoteCommand === 'stopped' || remoteCommand === 'stop') {
        showToast('Dryer stopped remotely', 'info');
        label = 'Stop command received';
      } else if (remoteCommand.includes('fan')) {
        showToast('Fan control changed remotely', 'info');
        label = 'Fan command received';
      } else {
        label = `${remoteCommand} command received`;
      }
      setCommandStatus(label);
      // Auto-clear after 10 seconds
      const timer = setTimeout(() => setCommandStatus(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [remoteCommand]);
  const { latestData: polledData, stalenessReason: polledStaleness } = useSensorData(device?.deviceId, isFallbackMode);
  const [isControlling, setIsControlling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) {
        deviceRefetch();
      }
    }, [deviceId])
  );

  const liveData = rtOnline ? (rtData || polledData) : (isFallbackMode ? polledData : null);
  const fbConnected = rtOnline && rtData !== null;

  const isServerUnreachable = !fbConnected && polledStaleness === 'server_unreachable';

  const [commandHistory, setCommandHistory] = useState<{ action: string; time: string }[]>([]);

  const addCommand = (action: string) => {
    setCommandHistory(prev => [{ action, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }, ...prev].slice(0, 10));
  };

  const handleStartDryer = async () => {
    if (!deviceId) return;
    Alert.alert('Start Dryer', `Start drying cycle for ${device?.name || deviceId}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        style: 'default',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setIsControlling(true);
          // Optimistic UI: update immediately
          addCommand('START (auto)');
          try {
            await grainApi.dryer.start(deviceId, DryerMode.Auto);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Dryer started successfully', 'success');
          } catch (err) {
            if (isNetworkError(err)) {
              await enqueueCommand({ id: `${Date.now()}-start`, deviceId, type: 'start', payload: { mode: DryerMode.Auto }, queuedAt: Date.now() });
              showToast('Offline — start command queued', 'warning');
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showToast(err instanceof Error ? err.message : 'Failed to start dryer', 'error');
            }
          } finally { setIsControlling(false); }
        },
      },
    ]);
  };

  const handleStopDryer = async () => {
    if (!deviceId) return;
    Alert.alert('Stop Dryer', `Stop drying cycle for ${device?.name || deviceId}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setIsControlling(true);
          // Optimistic UI: update immediately
          addCommand('STOP');
          try {
            await grainApi.dryer.stop(deviceId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Dryer stopped successfully', 'success');
          } catch (err) {
            if (isNetworkError(err)) {
              await enqueueCommand({ id: `${Date.now()}-stop`, deviceId, type: 'stop', payload: {}, queuedAt: Date.now() });
              showToast('Offline — stop command queued', 'warning');
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showToast(err instanceof Error ? err.message : 'Failed to stop dryer', 'error');
            }
          } finally { setIsControlling(false); }
        },
      },
    ]);
  };

  // Calculate derived values and memoized values (must be before conditional returns)
  const moisture = liveData?.moisture ?? 18.5;
  const temp = liveData?.temperature ?? 65.5;
  const humidity = liveData?.humidity ?? 42.3;
  const energy = liveData?.energy ?? 2.4;
  const fanSpeed = liveData?.fanSpeed ?? 75;
  const weight = liveData?.weight;
  const status = rtOnline ? (liveData?.status ?? 'idle') : 'idle';
  const isOnline = Boolean(device && rtOnline);
  const isRunning = isOnline && (status === DryerStatus.Running || status === 'drying');
  const hasLiveData = isOnline && liveData !== null;
  const targetM = DRYING.TARGET_MOISTURE;

  const progress = useMemo(
    () => moisture <= targetM ? 100 : Math.max(0, Math.round(((100 - moisture) / (100 - targetM)) * 100)),
    [moisture, targetM],
  );

  const isStale = useMemo(
    () => lastUpdated ? (Date.now() - lastUpdated.getTime()) > DRYING.STALE_THRESHOLD_MS : false,
    [lastUpdated],
  );

  const isVeryStale = useMemo(
    () => lastUpdated ? (Date.now() - lastUpdated.getTime()) > DRYING.VERY_STALE_THRESHOLD_MS : false,
    [lastUpdated],
  );

  const dryingAlert = useMemo(
    () => analyzeDryingStatus(moisture, targetM, temp),
    [moisture, targetM, temp],
  );

  // Fire local push notification when drying alert changes to non-normal
  useEffect(() => {
    if (dryingAlert && dryingAlert.type !== 'normal') {
      triggerDryingAlertNotification(dryingAlert, device?.deviceId);
    }
  }, [dryingAlert, device?.deviceId]);

  const staleVal = !hasLiveData ? '—' : isVeryStale ? '- -' : null;
  const sensors = useMemo(() => [
    { icon: 'thermometer-outline', val: staleVal ?? `${temp} °C`, label: 'TEMPERATURE', color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
    { icon: 'water-outline', val: staleVal ?? `${humidity} %`, label: 'HUMIDITY', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    { icon: 'analytics-outline', val: staleVal ?? `${moisture} %`, label: 'MOISTURE', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    { icon: 'scale-outline', val: staleVal ?? (weight ? `${weight} kg` : '—'), label: 'GRAIN WEIGHT', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    { icon: 'flash-outline', val: staleVal ?? `${energy} kWh`, label: 'ENERGY', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    { icon: 'speedometer-outline', val: staleVal ?? `${fanSpeed} %`, label: 'FAN SPEED', color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
    { icon: 'pulse-outline', val: staleVal ?? status.toUpperCase(), label: 'STATUS', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  ], [staleVal, temp, humidity, moisture, weight, energy, fanSpeed, status]);

  // Conditional returns must come after all hooks
  if (deviceLoading) {
    return (
      <SafeAreaViewCompat style={s.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <LinearGradientCompat colors={GRADIENTS.dashboard} style={s.gradient}>
          <Header showBack onBack={() => router.back()} />
          <View style={s.loadCenter}><ActivityIndicator size="large" color="#22C55E" /><Text style={s.loadText}>Loading device...</Text></View>
        </LinearGradientCompat>
      </SafeAreaViewCompat>
    );
  }

  if (deviceError || !device) {
    return (
      <SafeAreaViewCompat style={s.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <LinearGradientCompat colors={GRADIENTS.dashboard} style={s.gradient}>
          <Header showBack onBack={() => router.back()} />
          <View style={s.loadCenter}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={s.errorTxt}>{deviceError || 'Device not found'}</Text>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Text style={s.backBtnTxt}>Go Back</Text></TouchableOpacity>
          </View>
        </LinearGradientCompat>
      </SafeAreaViewCompat>
    );
  }

  return (
    <SafeAreaViewCompat style={s.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.dashboard} style={s.gradient}>
        <Header showBack onBack={() => router.back()} />
        <AnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollC}>
          <View style={s.greetRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greet}>{getGreeting()}, Farmer</Text>
              <Text style={s.greetSub}>Monitor your grain dryer</Text>
            </View>
            <View style={s.statusRow}>
              <StatusBadge status={isRunning ? DryerStatus.Running : isOnline ? DeviceStatus.Online : DeviceStatus.Offline} size="md" />
              {fbConnected && (<View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveTxt}>LIVE</Text></View>)}
            </View>
          </View>

          <Text style={s.lastUpd}>Last updated: {isOnline && lastUpdated ? formatTimeAgo(lastUpdated) : '--'}{!fbConnected && polledData && isOnline ? ' (polling)' : ''}</Text>

          {/* Command Status Banner */}
          {commandStatus && (
            <View style={s.cmdBanner}>
              <ActivityIndicator size="small" color="#22C55E" />
              <Text style={s.cmdBannerText}>{commandStatus}</Text>
            </View>
          )}

          {/* Drying Alert Banner */}
          {dryingAlert.type !== 'normal' && (
            <DryingAlertBanner severity={dryingAlert.severity} message={dryingAlert.message} action={dryingAlert.action} />
          )}

          <GrainDryingSimulation moisture={moisture} temperature={temp} isRunning={isRunning} targetMoisture={targetM} />

          <View style={s.card}><ProgressBar progress={progress} timeRemaining={isRunning ? 'Estimating...' : '--'} showLabel={true} showTime={true} /></View>

          {/* Stale Data Warning — distinguish server offline vs sensor not sending */}
          {(isStale && lastUpdated) || isServerUnreachable ? (
            isServerUnreachable ? (
              <View style={[s.staleBanner, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                <Ionicons name="cloud-offline-outline" size={18} color="#DC2626" />
                <Text style={[s.staleBannerText, { color: '#DC2626' }]}>
                  Server offline — unable to reach backend. Data may be outdated.
                </Text>
              </View>
            ) : (
              <View style={s.staleBanner}>
                <Ionicons name="warning-outline" size={18} color="#D97706" />
                <Text style={s.staleBannerText}>
                  Sensor data may be outdated — last update: {lastUpdated ? `${Math.round((Date.now() - lastUpdated.getTime()) / 60000)} min ago` : 'unknown'}
                </Text>
              </View>
            )
          ) : null}

          <View style={s.sensorGrid}>
            {sensors.map((sen) => (
              <View key={sen.label} style={s.sensorCard}>
                <View style={[s.sensorIconBg, { backgroundColor: sen.bg }]}><Ionicons name={sen.icon as any} size={22} color={sen.color} /></View>
                <Text style={[s.sensorVal, { color: sen.color }]}>{sen.val}</Text>
                <Text style={s.sensorLbl}>{sen.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.rowCards}>
            <View style={s.halfCard}><Text style={s.cardLbl}>STATUS</Text><Text style={isRunning ? s.cardValGreen : s.cardVal}>{isRunning ? 'Running' : 'Idle'}</Text><Text style={s.cardSub}>Fan Speed: {fanSpeed} %</Text></View>
            <View style={s.halfCard}><Text style={s.cardLbl}>MOISTURE</Text><Text style={s.cardVal}>{moisture} %</Text><Text style={s.cardSub}>Target: {targetM} %</Text></View>
          </View>

          <TouchableOpacity style={s.aiInsightsBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(Routes.AIPrediction); }} activeOpacity={0.7}>
            <Ionicons name="sparkles" size={18} color="#22C55E" />
            <Text style={s.aiInsightsTxt}>AI Insights</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Quick Actions */}
          <View style={s.quickActions}>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#22C55E' }]} onPress={handleStartDryer} disabled={isControlling || isRunning} activeOpacity={0.7}>
              <Ionicons name="play-outline" size={18} color="#FFFFFF" />
              <Text style={s.actionBtnTxt}>{isControlling ? 'Working...' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#EF4444' }]} onPress={handleStopDryer} disabled={isControlling || !isRunning} activeOpacity={0.7}>
              <Ionicons name="stop-outline" size={18} color="#FFFFFF" />
              <Text style={s.actionBtnTxt}>Stop</Text>
            </TouchableOpacity>
          </View>

          {/* Command History */}
          {commandHistory.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardLbl}>COMMAND HISTORY</Text>
              {commandHistory.map((cmd, i) => (
                <View key={i} style={s.cmdRow}>
                  <Ionicons name={cmd.action.startsWith('START') ? 'play-circle-outline' : 'stop-circle-outline'} size={16} color={cmd.action.startsWith('START') ? '#22C55E' : '#EF4444'} />
                  <Text style={s.cmdAction}>{cmd.action}</Text>
                  <Text style={s.cmdTime}>{cmd.time}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.bottomBanner}>
            <View style={s.bannerL}><View style={[s.bannerDot, { backgroundColor: isRunning ? '#22C55E' : '#9CA3AF' }]} /><Text style={s.bannerTxt}>{isRunning ? 'System Running' : 'System Idle'}</Text></View>
            <TouchableOpacity style={s.ctrlBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/(app)/control', params: { deviceId: device.deviceId } }); }} activeOpacity={0.7}><Text style={s.ctrlBtnTxt}>Control</Text></TouchableOpacity>
          </View>
        </ScrollView>
        </AnimatedView>
      </LinearGradientCompat>
    </SafeAreaViewCompat>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  loadCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280' },
  errorTxt: { color: '#EF4444', ...IOS_TYPOGRAPHY.footnote },
  backBtn: { backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 50, marginTop: 8 },
  backBtnTxt: { color: '#FFF', ...IOS_TYPOGRAPHY.headline },
  scroll: { flex: 1 },
  scrollC: { padding: 16, paddingBottom: 72, gap: 12 },
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greet: { ...IOS_TYPOGRAPHY.largeTitle, color: '#111' },
  greetSub: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280', marginTop: 2 },
  lastUpd: { ...IOS_TYPOGRAPHY.caption1, color: '#9CA3AF', marginTop: -4 },
  cmdBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 50, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  cmdBannerText: { ...IOS_TYPOGRAPHY.footnote, color: '#22C55E', fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  liveTxt: { fontSize: 11, color: '#16A34A', fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sensorCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFF', borderRadius: 16, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sensorIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sensorVal: { ...IOS_TYPOGRAPHY.title1 },
  sensorLbl: { ...IOS_TYPOGRAPHY.caption2, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowCards: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardLbl: { ...IOS_TYPOGRAPHY.caption2, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardVal: { ...IOS_TYPOGRAPHY.title2, color: '#111', marginBottom: 2 },
  cardValGreen: { ...IOS_TYPOGRAPHY.title2, color: '#22C55E', marginBottom: 2 },
  cardSub: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280' },
  bottomBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 16, padding: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  bannerL: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerDot: { width: 10, height: 10, borderRadius: 5 },
  bannerTxt: { ...IOS_TYPOGRAPHY.headline, color: '#111' },
  ctrlBtn: { backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 50, shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctrlBtnTxt: { color: '#FFF', ...IOS_TYPOGRAPHY.callout, fontWeight: '600' },
  aiInsightsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#22C55E' },
  aiInsightsTxt: { ...IOS_TYPOGRAPHY.callout, fontWeight: '600', color: '#16A34A', flex: 1, marginLeft: 8 },
  quickActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 50, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  actionBtnTxt: { color: '#FFFFFF', ...IOS_TYPOGRAPHY.headline },
  cmdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  cmdAction: { ...IOS_TYPOGRAPHY.footnote, color: '#111', flex: 1 },
  cmdTime: { ...IOS_TYPOGRAPHY.caption2, color: '#9CA3AF' },
  dryingAlertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, borderWidth: 1.5 },
  dryingAlertContent: { flex: 1, gap: 2 },
  dryingAlertMsg: { ...IOS_TYPOGRAPHY.footnote, fontWeight: '600' },
  dryingAlertAction: { ...IOS_TYPOGRAPHY.caption1, color: '#6B7280' },
  staleBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#F59E0B' },
  staleBannerText: { ...IOS_TYPOGRAPHY.footnote, color: '#D97706', fontWeight: '500', flex: 1 },
});
