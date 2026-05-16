import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Header } from '@/components';
import { useDevices } from '@/hooks';
import { useAIPrediction } from '@/hooks/useAIPrediction';
import { useDryingSession } from '@/context/DryingSessionContext';
import { useToast } from '@/context/AppContext';
import { GRADIENTS, IOS_TYPOGRAPHY, COLORS } from '@/utils/constants';
import { DeviceStatus } from '@/utils/enums';
import { formatTimeAgo } from '@/utils/formatters';

const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;
const AnimatedView = Animated.View as React.ComponentType<any>;

const GRAIN_TYPES = ['rice', 'corn', 'wheat', 'soybean', 'coffee'];

function formatDuration(seconds?: number): string {
  if (!seconds) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}


function SessionStatusBadge({ status }: { status: string }) {
  const config = {
    active: { bg: '#DCFCE7', text: '#166534', label: 'Active' },
    completed: { bg: '#DBEAFE', text: '#1E40AF', label: 'Completed' },
    aborted: { bg: '#FEE2E2', text: '#991B1B', label: 'Aborted' },
  };
  const c = config[status as keyof typeof config] || config.active;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {status === 'active' && <View style={styles.liveDot} />}
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function SimulationBadge() {
  return (
    <View style={styles.simulationBadge}>
      <Ionicons name="flask-outline" size={11} color="#166534" />
      <Text style={styles.simulationBadgeText}>Demo</Text>
    </View>
  );
}

export default function SessionsScreen() {
  const { devices } = useDevices();
  const { sessions, activeSession, isLoading, error, refetch, startDrying, stopDrying, getLastError } = useDryingSession();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedGrain, setSelectedGrain] = useState('rice');
  const [targetMoisture, setTargetMoisture] = useState(14);
  const [starting, setStarting] = useState(false);

  // AI prediction for the active session's device
  const aiSensorInput = activeSession ? {
    deviceId: activeSession.deviceId,
    temperature: activeSession.avgTemperature ?? 45,
    humidity: activeSession.avgHumidity ?? 50,
    moisture: activeSession.currentMoisture ?? 20,
    fanSpeed: activeSession.avgFanSpeed ?? 70,
    timeElapsed: activeSession.startedAt
      ? Math.round((Date.now() - new Date(activeSession.startedAt).getTime()) / 60000)
      : 0,
  } : null;
  const { prediction: aiPrediction } = useAIPrediction(aiSensorInput, {
    pollInterval: activeSession ? 30000 : 0,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleStart = async () => {
    if (!selectedDeviceId) {
      showToast('Please select a device', 'warning');
      return;
    }
    if (activeSession?.deviceId === selectedDeviceId) {
      showToast(`${selectedDeviceId} already has an active drying session`, 'warning');
      return;
    }
    const selectedDevice = devices.find(device => device.deviceId === selectedDeviceId);
    if (!selectedDevice || selectedDevice.status !== DeviceStatus.Online) {
      showToast('Device is offline. Power on the prototype and wait for live sensor data first.', 'warning');
      return;
    }
    setStarting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await startDrying({ deviceId: selectedDeviceId, grainType: selectedGrain, targetMoisture });
    setStarting(false);
    if (result) {
      await refetch();
      showToast('Drying session started!', 'success');
      setShowStartModal(false);
    } else {
      showToast(getLastError() || error || 'Failed to start session', 'error');
    }
  };

  const handleEnd = async (sessionId: string, action: 'complete' | 'abort') => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await stopDrying(action);
    if (success) {
      showToast(action === 'complete' ? 'Session completed!' : 'Session aborted', action === 'complete' ? 'success' : 'warning');
    } else {
      showToast('Failed to end session — please try again', 'error');
    }
  };

  const progress = activeSession
    ? Math.min(100, Math.max(0, Math.round(((activeSession.startMoisture - activeSession.currentMoisture) / (activeSession.startMoisture - activeSession.targetMoisture)) * 100)))
    : 0;

  return (
    <SafeAreaViewCompat style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.dashboard} style={styles.gradient}>
        <Header />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {/* Title */}
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.screenTitle}>Drying Sessions</Text>
              <Text style={styles.screenSubtitle}>Track grain drying operations</Text>
            </View>
            <TouchableOpacity style={styles.startButton} onPress={() => setShowStartModal(true)}>
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.startButtonText}>Start</Text>
            </TouchableOpacity>
          </View>

          {/* Active Session Card */}
          {activeSession && (
            <AnimatedView entering={FadeIn.duration(300)}>
              <View style={styles.activeCard}>
                <View style={styles.activeCardHeader}>
                  <View>
                    <Text style={styles.activeDeviceId}>{activeSession.deviceId}</Text>
                    <Text style={styles.activeGrain}>{activeSession.grainType} | Target: {activeSession.targetMoisture}%</Text>
                  </View>
                  <SessionStatusBadge status="active" />
                </View>

                {/* Progress */}
                <View style={styles.progressSection}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressText}>Drying Progress</Text>
                    <Text style={styles.progressPercent}>{progress}%</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                </View>

                {/* Metrics Grid */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Ionicons name="water-outline" size={16} color="#3B82F6" />
                    <Text style={styles.metricValue}>{activeSession.currentMoisture?.toFixed(1)}%</Text>
                    <Text style={styles.metricLabel}>Moisture</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Ionicons name="thermometer-outline" size={16} color="#F97316" />
                    <Text style={styles.metricValue}>{activeSession.avgTemperature?.toFixed(1)}°C</Text>
                    <Text style={styles.metricLabel}>Avg Temp</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Ionicons name="flash-outline" size={16} color="#EAB308" />
                    <Text style={styles.metricValue}>{activeSession.totalEnergyUsed?.toFixed(1)}</Text>
                    <Text style={styles.metricLabel}>kWh</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Ionicons name="time-outline" size={16} color="#8B5CF6" />
                    <Text style={styles.metricValue}>{formatDuration(Math.round((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000))}</Text>
                    <Text style={styles.metricLabel}>Elapsed</Text>
                  </View>
                </View>

                {/* AI Insight */}
                {aiPrediction && (
                  <View style={styles.aiRow}>
                    <Ionicons
                      name={aiPrediction.recommendationType === 'optimal' ? 'sparkles' : aiPrediction.recommendationType === 'warning' ? 'warning-outline' : 'alert-circle-outline'}
                      size={14}
                      color={aiPrediction.recommendationType === 'optimal' ? COLORS.primary : aiPrediction.recommendationType === 'warning' ? '#D97706' : '#DC2626'}
                    />
                    <Text style={[styles.aiText, {
                      color: aiPrediction.recommendationType === 'optimal' ? COLORS.primaryDark : aiPrediction.recommendationType === 'warning' ? '#D97706' : '#DC2626',
                    }]}>
                      {aiPrediction.recommendation}
                    </Text>
                    {aiPrediction.estimatedMinutesToTarget > 0 && (
                      <Text style={styles.aiEta}>
                        ~{aiPrediction.estimatedMinutesToTarget < 60
                          ? `${aiPrediction.estimatedMinutesToTarget}m`
                          : `${Math.floor(aiPrediction.estimatedMinutesToTarget / 60)}h ${aiPrediction.estimatedMinutesToTarget % 60}m`}
                      </Text>
                    )}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.completeBtn} onPress={() => handleEnd(activeSession._id, 'complete')}>
                    <Ionicons name="checkmark-circle" size={18} color="#166534" />
                    <Text style={styles.completeBtnText}>Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.abortBtn} onPress={() => handleEnd(activeSession._id, 'abort')}>
                    <Ionicons name="close-circle" size={18} color="#991B1B" />
                    <Text style={styles.abortBtnText}>Abort</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </AnimatedView>
          )}

          {/* Session History */}
          <View style={styles.historyTitleRow}>
            <Text style={styles.sectionTitle}>History</Text>
            {sessions.some(session => session.isSimulated) && (
              <Text style={styles.historyHint}>Includes seeded drying runs</Text>
            )}
          </View>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color="#991B1B" />
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={refetch} style={styles.errorRetry}>
                <Text style={styles.errorRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={48} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No sessions yet</Text>
              <Text style={styles.emptySubtext}>Start your first drying session</Text>
            </View>
          ) : (
            sessions.filter(s => s._id !== activeSession?._id).map((session) => (
              <View key={session._id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View>
                    <View style={styles.historyDeviceRow}>
                      <Text style={styles.historyDevice}>{session.deviceId}</Text>
                      {session.isSimulated && <SimulationBadge />}
                    </View>
                    <Text style={styles.historyTime}>{formatTimeAgo(session.startedAt)}</Text>
                  </View>
                  <SessionStatusBadge status={session.status} />
                </View>
                <View style={styles.historyMetrics}>
                  <Text style={styles.historyMetric}>
                    {session.startMoisture?.toFixed(1)}% → {(session.finalMoisture || session.currentMoisture)?.toFixed(1)}%
                  </Text>
                  <Text style={styles.historyMetric}>{formatDuration(session.duration)}</Text>
                  {session.efficiency != null && (
                    <Text style={[styles.historyMetric, { color: session.efficiency >= 80 ? '#166534' : session.efficiency >= 50 ? '#92400E' : '#991B1B' }]}>
                      {session.efficiency}% eff.
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradientCompat>

      {/* Start Session Modal */}
      <Modal visible={showStartModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start Drying Session</Text>

            {/* Device Picker */}
            <Text style={styles.inputLabel}>Device</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {(devices || []).map((d) => {
                const isOffline = d.status !== DeviceStatus.Online;
                return (
              <TouchableOpacity
                  key={d.deviceId}
                  style={[
                    styles.chip,
                    selectedDeviceId === d.deviceId && styles.chipActive,
                    (isOffline || activeSession?.deviceId === d.deviceId) && styles.chipDisabled,
                  ]}
                  onPress={() => {
                    if (isOffline) {
                      showToast(`${d.deviceId} is offline`, 'warning');
                      return;
                    }
                    if (activeSession?.deviceId === d.deviceId) {
                      showToast(`${d.deviceId} already has an active session`, 'warning');
                      return;
                    }
                    setSelectedDeviceId(d.deviceId);
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    selectedDeviceId === d.deviceId && styles.chipTextActive,
                    (isOffline || activeSession?.deviceId === d.deviceId) && styles.chipTextDisabled,
                  ]}>
                    {d.deviceId}{isOffline ? ' · Offline' : activeSession?.deviceId === d.deviceId ? ' · Active' : ''}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Grain Type */}
            <Text style={styles.inputLabel}>Grain Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {GRAIN_TYPES.map((grain) => (
                <TouchableOpacity
                  key={grain}
                  style={[styles.chip, selectedGrain === grain && styles.chipActive]}
                  onPress={() => setSelectedGrain(grain)}
                >
                  <Text style={[styles.chipText, selectedGrain === grain && styles.chipTextActive]}>
                    {grain.charAt(0).toUpperCase() + grain.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Target Moisture */}
            <Text style={styles.inputLabel}>Target Moisture: {targetMoisture}%</Text>
            <View style={styles.targetRow}>
              {[12, 13, 14, 15, 16].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.chip, targetMoisture === val && styles.chipActive]}
                  onPress={() => setTargetMoisture(val)}
                >
                  <Text style={[styles.chipText, targetMoisture === val && styles.chipTextActive]}>{val}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStartModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleStart} disabled={starting}>
                {starting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.confirmBtnText}>Start</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  screenTitle: { ...IOS_TYPOGRAPHY.title1, color: '#111' },
  screenSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  startButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  startButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Active session
  activeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  activeDeviceId: { fontSize: 16, fontWeight: '700', color: '#111' },
  activeGrain: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  progressSection: { marginBottom: 14 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: COLORS.textSecondary },
  progressPercent: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  progressBar: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  metricItem: { alignItems: 'center', flex: 1 },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#111', marginTop: 4 },
  metricLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  aiText: { ...IOS_TYPOGRAPHY.caption1, fontWeight: '500', flex: 1 },
  aiEta: { ...IOS_TYPOGRAPHY.caption2, color: COLORS.textSecondary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  completeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingVertical: 10, borderRadius: 10 },
  completeBtnText: { fontSize: 13, fontWeight: '600', color: '#166534' },
  abortBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEE2E2', paddingVertical: 10, borderRadius: 10 },
  abortBtnText: { fontSize: 13, fontWeight: '600', color: '#991B1B' },

  // History
  historyTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { ...IOS_TYPOGRAPHY.title3, color: '#111' },
  historyHint: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  historyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  historyDeviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyDevice: { fontSize: 14, fontWeight: '600', color: '#111' },
  historyTime: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  historyMetrics: { flexDirection: 'row', gap: 12 },
  historyMetric: { fontSize: 12, color: COLORS.textSecondary },
  simulationBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  simulationBadgeText: { fontSize: 10, fontWeight: '700', color: '#166534' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#111', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  // Error banner
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorBannerText: { flex: 1, fontSize: 13, color: '#991B1B' },
  errorRetry: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#991B1B', borderRadius: 6 },
  errorRetryText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { ...IOS_TYPOGRAPHY.title2, color: '#111', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 14 },
  chipScroll: { marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  chipActive: { backgroundColor: COLORS.primary },
  chipDisabled: { backgroundColor: '#F9FAFB', opacity: 0.65 },
  chipText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  chipTextActive: { color: '#fff' },
  chipTextDisabled: { color: '#9CA3AF' },
  targetRow: { flexDirection: 'row', gap: 8 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.primary },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
