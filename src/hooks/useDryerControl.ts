import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { grainApi, isNetworkError } from '@/api';
import type { Device } from '@/api';
import { useRealtimeSensor } from './useRealtimeSensor';
import { useToastContext } from '@/context/ToastContext';
import { useDryingSession } from '@/context/DryingSessionContext';
import { DRYING } from '@/utils/constants';
import { DryerMode, SensorThreshold, StorageKeys } from '@/utils/enums';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueCommand } from '@/utils/commandQueue';

interface DryerControlState {
  mode: DryerMode;
  isRunning: boolean;
  temperature: number;
  fanSpeed: number;
  isControlling: boolean;
  syncingUntil: number | null;
  commandAck: boolean;
  commandTimeout: boolean;
  selectedDevice: Device | null;
  pendingDeviceId: string | null;
}

interface DryerControlActions {
  setMode: (mode: DryerMode) => void;
  setTemperature: (temp: number) => void;
  setFanSpeed: (speed: number) => void;
  setSelectedDevice: (device: Device | null) => void;
  setSyncingUntil: (ms: number | null) => void;
  handleStartDryer: () => void;
  handleStopDryer: () => void;
}

export type UseDryerControlReturn = DryerControlState & DryerControlActions & {
  isLoading: boolean;
  error: string | null;
};

export function useDryerControl(devices: Device[], devicesLoading: boolean): UseDryerControlReturn {
  const { showToast } = useToastContext();
  const sessionCtx = useDryingSession();

  const [mode, setMode] = useState<DryerMode>(DryerMode.Auto);
  const [temperature, setTemperature] = useState(55);
  const [fanSpeed, setFanSpeed] = useState(75);
  const [isControlling, setIsControlling] = useState(false);
  const [syncingUntil, setSyncingUntil] = useState<number | null>(null);
  const [commandAck, setCommandAck] = useState(false);
  const [commandTimeout, setCommandTimeout] = useState(false);
  const [optimisticRunning, setOptimisticRunning] = useState<boolean | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceId = selectedDevice?.deviceId;
  const { commandAcknowledged, isOnline: deviceOnline, runtimeState, sensorData } = useRealtimeSensor(deviceId);

  // Restore persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const keys = [
          StorageKeys.ControlMode,
          StorageKeys.ControlTemperature,
          StorageKeys.ControlFanSpeed,
          StorageKeys.ControlSelectedDeviceId,
        ];
        const saved = await AsyncStorage.multiGet(keys);
        const map = Object.fromEntries(saved);
        if (map[StorageKeys.ControlMode]) setMode(map[StorageKeys.ControlMode] as DryerMode);
        if (map[StorageKeys.ControlTemperature]) setTemperature(parseFloat(map[StorageKeys.ControlTemperature]));
        if (map[StorageKeys.ControlFanSpeed]) setFanSpeed(parseInt(map[StorageKeys.ControlFanSpeed], 10));
        if (map[StorageKeys.ControlSelectedDeviceId]) {
          setPendingDeviceId(map[StorageKeys.ControlSelectedDeviceId]);
        }
      } catch {
        // Silent — state will use defaults
      }
      setRestored(true);
    })();
  }, []);

  // Persist state on change
  useEffect(() => {
    if (!restored) return;
    AsyncStorage.multiSet([
      [StorageKeys.ControlMode, mode],
      [StorageKeys.ControlTemperature, String(temperature)],
      [StorageKeys.ControlFanSpeed, String(fanSpeed)],
      [StorageKeys.ControlSelectedDeviceId, selectedDevice?.deviceId || ''],
    ]).catch(() => {});
  }, [restored, mode, temperature, fanSpeed, selectedDevice]);

  // Resolve pending device when devices load
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

  // Firebase command acknowledgement
  useEffect(() => {
    if (commandAcknowledged && syncingUntil !== null) {
      setCommandAck(true);
      setCommandTimeout(false);
      setSyncingUntil(null);
      setOptimisticRunning(null);
      const timer = setTimeout(() => setCommandAck(false), DRYING.COMMAND_ACK_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [commandAcknowledged, syncingUntil]);

  useEffect(() => {
    if (
      syncingUntil !== null &&
      (runtimeState?.commandStatus === 'failed' ||
        runtimeState?.commandStatus === 'timeout' ||
        runtimeState?.commandStatus === 'error')
    ) {
      setCommandAck(false);
      setCommandTimeout(true);
      setSyncingUntil(null);
      setOptimisticRunning(null);
      const timer = setTimeout(() => setCommandTimeout(false), DRYING.COMMAND_TIMEOUT_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [runtimeState?.commandStatus, syncingUntil]);

  // Command timeout detection
  useEffect(() => {
    if (syncingUntil !== null) {
      const remaining = syncingUntil - Date.now();
      const timeoutMs = Math.max(0, remaining);
      const timer = setTimeout(() => {
        if (!commandAck) {
          setCommandTimeout(true);
          setSyncingUntil(null);
          setOptimisticRunning(null);
          setTimeout(() => setCommandTimeout(false), DRYING.COMMAND_TIMEOUT_DISPLAY_MS);
        }
      }, timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [commandAck, syncingUntil]);

  // Derive isRunning from shared context — true when context has an active session for this device
  // Hardware-reported state (S:running|idle from the UNO, mirrored to Firebase)
  // is ground truth whenever we have live sensor data.
  const hwRunning = sensorData ? sensorData.status === 'running' : null;
  const actualRunning = hwRunning !== null
    ? hwRunning
    : Boolean(runtimeState?.isRunning || (sessionCtx.isRunning && sessionCtx.activeDeviceId === deviceId));
  const isRunning = optimisticRunning ?? actualRunning;

  useEffect(() => {
    if (optimisticRunning !== null && runtimeState?.isRunning === optimisticRunning) {
      setOptimisticRunning(null);
    }
  }, [optimisticRunning, runtimeState?.isRunning]);

  // Rule-based AUTO adjustment using live DHT22 temperature/humidity.
  // REDUCE_TEMP when too hot, INCREASE_TEMP when too cool, INCREASE_FAN when ambient humidity is high.
  useEffect(() => {
    if (mode !== DryerMode.Auto || !isRunning || !deviceId || !sensorData) return;

    const adjust = async () => {
      const temp = sensorData.temperature;
      const humidity = sensorData.humidity;

      let newTemp = temperature;
      let newFan = fanSpeed;

      if (temp > SensorThreshold.HighTempRisk) {
        newTemp = Math.max(35, temperature - 5);
      } else if (temp < SensorThreshold.OptTempMin) {
        newTemp = Math.min(65, temperature + 5);
      }

      if (humidity > SensorThreshold.HumidityWarning && fanSpeed < 100) {
        newFan = Math.min(100, fanSpeed + 15);
      }

      if (newTemp === temperature && newFan === fanSpeed) return;

      setTemperature(newTemp);
      setFanSpeed(newFan);

      try {
        await grainApi.dryer.start(deviceId, DryerMode.Auto, newTemp, newFan);
      } catch { /* silent — next poll will retry */ }
    };

    adjust();
    const interval = setInterval(adjust, DRYING.AI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode, isRunning, deviceId, sensorData, temperature, fanSpeed]);

  const handleStopDryer = useCallback(() => {
    if (isControlling || runtimeState?.pendingCommand) return;
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
          setCommandAck(false);
          setCommandTimeout(false);
          setOptimisticRunning(false);
          setSyncingUntil(Date.now() + DRYING.SYNC_WINDOW_MS);
          try {
            const ok = await sessionCtx.stopDrying('complete');
            if (ok) {
              showToast('Dryer stopped successfully', 'success');
            } else {
              const msg = sessionCtx.error || 'Failed to stop dryer';
              // Failure (server said no): KEEP showing RUNNING so the user can retry STOP -
              // the physical dryer is still running until a real STOP lands.
              setOptimisticRunning(true);
              showToast(String(msg || 'Failed to stop dryer'), 'error');
            }
          } catch (err) {
            // Transport-level failure: queue the stop for the offline flusher.
            setOptimisticRunning(null);
            await enqueueCommand({ id: `${Date.now()}-stop`, deviceId, type: 'stop', payload: {}, queuedAt: Date.now() });
            showToast('Connection issue - stop command queued', 'warning');
          } finally {
            setIsControlling(false);
          }
        },
      },
    ]);
  }, [deviceId, sessionCtx, showToast, isControlling, runtimeState?.pendingCommand]);

  const handleStartDryer = useCallback(() => {
    if (isControlling || runtimeState?.pendingCommand) return;
    if (!deviceId) {
      Alert.alert('No Device', 'Please select a device first.');
      return;
    }
    if (!deviceOnline) {
      Alert.alert('Device Offline', 'Power on the prototype and wait for live sensor data before starting a drying cycle.');
      return;
    }
    const deviceName = selectedDevice?.name || deviceId;
    Alert.alert(
      'Start Dryer',
      `Start drying cycle?

Device: ${deviceName}
Mode: ${mode === DryerMode.Auto ? 'Auto' : 'Manual'}
${mode === DryerMode.Manual ? `Temp: ${temperature.toFixed(1)}°C
Fan: ${fanSpeed}%` : 'Settings will be adjusted automatically based on temperature and humidity'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          style: 'default',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsControlling(true);
            setCommandAck(false);
            setCommandTimeout(false);
            setOptimisticRunning(true);
            setSyncingUntil(Date.now() + DRYING.SYNC_WINDOW_MS);
            try {
              const session = await sessionCtx.startDrying({
                deviceId, mode, temperature, fanSpeed,
              });
              if (session) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast('Dryer started successfully', 'success');
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                const msg = sessionCtx.getLastError() || sessionCtx.error || 'Failed to start dryer';
                if (msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('connection')) {
                  setOptimisticRunning(null);
                  await enqueueCommand({ id: `${Date.now()}-start`, deviceId, type: 'start', payload: { mode, temperature, fanSpeed }, queuedAt: Date.now() });
                  showToast('Offline — start command queued', 'warning');
                } else {
                  setOptimisticRunning(null);
                  showToast(String(msg || 'Failed to stop dryer'), 'error');
                }
              }
            } catch (err) {
              setOptimisticRunning(null);
              showToast(err instanceof Error ? err.message : 'Failed to start dryer', 'error');
            } finally {
              setIsControlling(false);
            }
          },
        },
      ],
    );
  }, [deviceId, selectedDevice, mode, temperature, fanSpeed, sessionCtx, showToast, deviceOnline, isControlling, runtimeState?.pendingCommand]);

  return {
    mode,
    isRunning,
    temperature,
    fanSpeed,
    isControlling,
    syncingUntil,
    commandAck,
    commandTimeout,
    selectedDevice,
    pendingDeviceId,
    setMode,
    setTemperature,
    setFanSpeed,
    setSelectedDevice,
    setSyncingUntil,
    handleStartDryer,
    handleStopDryer,
    isLoading: devicesLoading,
    error,
  };
}