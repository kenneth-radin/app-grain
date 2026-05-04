import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Header, Navigation, StatusBadge, CommandStatusBanner, DeviceSelector, DryerModeSelector, TemperatureSlider, FanControlPanel, AIAutoStopCard } from '@/components';
import { useDevices, useDryerControl, useFanControl } from '@/hooks';
import { useServerStatusContext } from '@/context/ServerStatusContext';
import { GRADIENTS, IOS_TYPOGRAPHY, COLORS } from '@/utils/constants';
import { DryerMode, DryerStatus } from '@/utils/enums';

export default function ControlScreen() {
  const { devices, isLoading: devicesLoading } = useDevices();
  const serverCtx = useServerStatusContext();

  const dryer = useDryerControl(devices, devicesLoading);
  const fan = useFanControl(dryer.selectedDevice?.deviceId, dryer.syncingUntil, dryer.setSyncingUntil);

  const deviceId = dryer.selectedDevice?.deviceId;

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
            <StatusBadge status={dryer.isRunning ? DryerStatus.Running : DryerStatus.Idle} size="md" />
          </View>

          <CommandStatusBanner
            commandAck={dryer.commandAck}
            commandTimeout={dryer.commandTimeout}
            syncingUntil={dryer.syncingUntil}
            isServerOnline={serverCtx.isServerOnline}
            queuedCommandCount={serverCtx.queuedCommandCount}
          />

          <DeviceSelector
            devices={devices}
            selectedDevice={dryer.selectedDevice}
            onSelectDevice={dryer.setSelectedDevice}
          />

          {devicesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading devices...</Text>
            </View>
          ) : !deviceId ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="hardware-chip-outline" size={48} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No devices available</Text>
              <Text style={styles.emptySubtext}>Add a device from the Dashboard first</Text>
            </View>
          ) : (
            <>
              <DryerModeSelector
                mode={dryer.mode}
                isRunning={dryer.isRunning}
                isControlling={dryer.isControlling}
                onModeChange={dryer.setMode}
                onStart={dryer.handleStartDryer}
                onStop={dryer.handleStopDryer}
                deviceName={dryer.selectedDevice?.name || dryer.selectedDevice?.deviceId}
              />

              {/* AI Auto Mode Banner */}
              {dryer.mode === DryerMode.Auto && dryer.isRunning && (
                <AIAutoStopCard
                  aiPrediction={dryer.aiPrediction}
                  aiLoading={dryer.aiLoading}
                  aiAutoStopped={dryer.aiAutoStopped}
                />
              )}

              <TemperatureSlider
                mode={dryer.mode}
                temperature={dryer.temperature}
                fanSpeed={dryer.fanSpeed}
                onTemperatureChange={dryer.setTemperature}
                onFanSpeedChange={dryer.setFanSpeed}
                onModeChange={dryer.setMode}
              />

              <FanControlPanel
                mode={dryer.mode}
                fan1Status={fan.fan1Status}
                fan2Status={fan.fan2Status}
                fan1Loading={fan.fan1Loading}
                fan2Loading={fan.fan2Loading}
                bothLoading={fan.bothLoading}
                onFanControl={fan.handleFanControl}
              />
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
  screenTitle: {
    ...IOS_TYPOGRAPHY.largeTitle,
    color: COLORS.textPrimary,
  },
  screenSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.title3,
    fontWeight: '700',
    color: COLORS.gray[700],
    marginTop: 8,
  },
  emptySubtext: {
    ...IOS_TYPOGRAPHY.footnote,
    color: COLORS.textSecondary,
  },
});
