import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Header, StatusBadge, CommandStatusBanner, DeviceSelector, DryerModeSelector, TemperatureSlider, FanControlPanel } from '@/components';
import { useDevices, useDryerControl, useFanControl, useHeaterControl, useRealtimeSensor } from '@/hooks';
import { useServerStatusContext } from '@/context/ServerStatusContext';
import { GRADIENTS, IOS_TYPOGRAPHY, COLORS } from '@/utils/constants';
import { DryerMode, DryerStatus } from '@/utils/enums';

const SafeAreaViewCompat = SafeAreaView as React.ComponentType<any>;
const LinearGradientCompat = LinearGradient as React.ComponentType<any>;

export default function ControlScreen() {
  const params = useLocalSearchParams<{ deviceId?: string }>();
  const { devices, isLoading: devicesLoading } = useDevices();
  const serverCtx = useServerStatusContext();

  const dryer = useDryerControl(devices, devicesLoading);
  const fan = useFanControl(
    dryer.selectedDevice?.deviceId,
    dryer.syncingUntil,
    dryer.setSyncingUntil,
    dryer.commandAck,
    dryer.commandTimeout,
  );
  const heater = useHeaterControl(
    dryer.selectedDevice?.deviceId,
    dryer.setSyncingUntil,
    dryer.commandAck,
    dryer.commandTimeout,
  );
  const { sensorData, runtimeState } = useRealtimeSensor(dryer.selectedDevice?.deviceId);

  const deviceId = dryer.selectedDevice?.deviceId;
  const fan1Status = ((runtimeState?.fan1State as 'ON' | 'OFF' | undefined) ?? fan.fan1Status) || 'OFF';
  const fan2Status = ((runtimeState?.fan2State as 'ON' | 'OFF' | undefined) ?? fan.fan2Status) || 'OFF';
  const heaterStatus = ((runtimeState?.heaterState as 'ON' | 'OFF' | undefined) ?? heater.heaterStatus) || 'OFF';
  const selectedDeviceId = dryer.selectedDevice?.deviceId;
  const setSelectedDevice = dryer.setSelectedDevice;

  useEffect(() => {
    if (!params.deviceId || devices.length === 0) return;
    if (selectedDeviceId === params.deviceId) return;

    const requestedDevice = devices.find(device => device.deviceId === params.deviceId);
    if (requestedDevice) {
      setSelectedDevice(requestedDevice);
    }
  }, [devices, params.deviceId, selectedDeviceId, setSelectedDevice]);

  return (
    <SafeAreaViewCompat style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradientCompat colors={GRADIENTS.control} style={styles.gradient}>
        <Header />
        <View style={{ flex: 1 }}>
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
            commandStatus={runtimeState?.commandStatus}
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
                fan1Status={fan1Status}
                fan1Loading={fan.fan1Loading}
                onFanControl={fan.controlFan}
              />

              <AdvancedControls
                fan2Status={fan2Status}
                fan2Loading={fan.fan2Loading || fan.bothLoading}
                bothLoading={fan.bothLoading}
                heaterStatus={heaterStatus}
                heaterLoading={heater.heaterLoading}
                onFan2On={() => fan.controlFan2('ON')}
                onFan2Off={() => fan.controlFan2('OFF')}
                onAllFansOn={() => fan.controlAllFans('ON')}
                onAllFansOff={() => fan.controlAllFans('OFF')}
                onHeaterOn={heater.heaterOn}
                onHeaterOff={heater.heaterOff}
              />
            </>
          )}
        </ScrollView>
        </View>
      </LinearGradientCompat>
    </SafeAreaViewCompat>
  );
}

function AdvancedControls({
  fan2Status,
  fan2Loading,
  bothLoading,
  heaterStatus,
  heaterLoading,
  onFan2On,
  onFan2Off,
  onAllFansOn,
  onAllFansOff,
  onHeaterOn,
  onHeaterOff,
}: {
  fan2Status: 'ON' | 'OFF';
  fan2Loading: boolean;
  bothLoading: boolean;
  heaterStatus: 'ON' | 'OFF';
  heaterLoading: boolean;
  onFan2On: () => void;
  onFan2Off: () => void;
  onAllFansOn: () => void;
  onAllFansOff: () => void;
  onHeaterOn: () => void;
  onHeaterOff: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.controlHeader}>
        <Ionicons name="options-outline" size={18} color={COLORS.textSecondary} />
        <Text style={styles.cardLabel}>ADVANCED CONTROLS</Text>
      </View>

      <ToggleRow
        icon="aperture-outline"
        label="Fan 2"
        status={fan2Status}
        loading={fan2Loading}
        onOn={onFan2On}
        onOff={onFan2Off}
      />

      <View style={styles.controlRow}>
        <View style={styles.controlLabelRow}>
          <Ionicons name="sync-outline" size={16} color={COLORS.primary} />
          <Text style={styles.controlLabel}>All Fans</Text>
        </View>
        <View style={styles.controlButtonsRow}>
          <CommandButton label="ON" active loading={bothLoading} onPress={onAllFansOn} />
          <CommandButton label="OFF" danger loading={bothLoading} onPress={onAllFansOff} />
        </View>
      </View>

      <ToggleRow
        icon="flame-outline"
        label="Heater"
        status={heaterStatus}
        loading={heaterLoading}
        onOn={onHeaterOn}
        onOff={onHeaterOff}
      />
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  status,
  loading,
  onOn,
  onOff,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  status: 'ON' | 'OFF';
  loading: boolean;
  onOn: () => void;
  onOff: () => void;
}) {
  return (
    <View style={styles.controlRow}>
      <View style={styles.controlLabelRow}>
        <Ionicons name={icon} size={16} color={status === 'ON' ? COLORS.primary : COLORS.gray[400]} />
        <Text style={styles.controlLabel}>{label}</Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, status === 'ON' ? styles.statusDotOn : styles.statusDotOff]} />
          <Text style={[styles.statusText, status === 'ON' ? styles.statusOn : styles.statusOff]}>{status}</Text>
        </View>
      </View>
      <View style={styles.controlButtonsRow}>
        <CommandButton label="ON" active={status === 'ON'} loading={loading && status === 'ON'} onPress={onOn} disabled={loading} />
        <CommandButton label="OFF" danger={status === 'OFF'} loading={loading && status === 'OFF'} onPress={onOff} disabled={loading} />
      </View>
    </View>
  );
}

function CommandButton({
  label,
  active = false,
  danger = false,
  loading = false,
  disabled = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const activeStyle = active ? styles.commandButtonActive : danger ? styles.commandButtonDanger : undefined;
  return (
    <TouchableOpacity
      style={[styles.commandButton, activeStyle, (loading || disabled) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={active || danger ? COLORS.white : COLORS.primary} />
      ) : (
        <Text style={[styles.commandButtonText, (active || danger) && styles.commandButtonTextActive]}>{label}</Text>
      )}
    </TouchableOpacity>
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
  card: {
    backgroundColor: COLORS.card,
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
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  controlBlock: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    gap: 10,
  },
  controlLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  controlLabel: {
    ...IOS_TYPOGRAPHY.callout,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOn: {
    backgroundColor: COLORS.primary,
  },
  statusDotOff: {
    backgroundColor: COLORS.gray[400],
  },
  statusText: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
  },
  statusOn: {
    color: COLORS.primary,
  },
  statusOff: {
    color: COLORS.gray[400],
  },
  controlButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  commandButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: COLORS.gray[100],
    minWidth: 58,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandButtonActive: {
    backgroundColor: COLORS.primary,
  },
  commandButtonDanger: {
    backgroundColor: COLORS.danger,
  },
  commandButtonText: {
    ...IOS_TYPOGRAPHY.footnote,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  commandButtonTextActive: {
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
