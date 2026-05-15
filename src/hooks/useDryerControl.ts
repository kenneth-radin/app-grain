import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { grainApi, isNetworkError } from '@/api';
import type { Device } from '@/api';
import { useRealtimeSensor } from './useRealtimeSensor';
import { useToastContext } from '@/context/ToastContext';
import { useDryingSession } from '@/context/DryingSessionContext';
import { runPrediction } from './useAIPrediction';
import type { SensorInput } from './useAIPrediction';
import type { AIPrediction } from './useAIPrediction';
import { DRYING } from '@/utils/constants';
import { DryerMode, StorageKeys } from '@/utils/enums';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueCommand } from '@/utils/commandQueue';

interface DryerControlState {
  mode: DryerMode;
  isRunning: boolean;
  temperature: number;
  fanSpeed: number;
  isControlling: boolean;
  aiAutoStopped: boolean;
  aiPrediction: AIPrediction | null;
  aiLoading: boolean;
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
  const [aiAutoStopped, setAiAutoStopped] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [syncingUntil, setSyncingUntil] = useState<number | null>(null);
  const [commandAck, setCommandAck] = useState(false);
  const [commandTimeout, setCommandTimeout] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceId = selectedDevice?.deviceId;
  const { commandAcknowledged, isOnline: deviceOnline, runtimeState } = useRealtimeSensor(deviceId);

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
      const timer = setTimeout(() => setCommandAck(false), DRYING.COMMAND_ACK_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [commandAcknowledged]);

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
      const timer = setTimeout(() => setCommandTimeout(false), DRYING.COMMAND_TIMEOUT_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [runtimeState?.commandStatus, syncingUntil]);

  // Command timeout detection
  useEffect(() => {
    if (syncingUntil !== null) {
      const remaining = syncingUntil - Date.now();
      const timeoutMs = Math.max(remaining, DRYING.COMMAND_ACK_TIMEOUT_MS);
      const timer = setTimeout(() => {
        if (!commandAck) {
          setCommandTimeout(true);
          setSyncingUntil(null);
          setTimeout(() => setCommandTimeout(false), DRYING.COMMAND_TIMEOUT_DISPLAY_MS);
        }
      }, timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [syncingUntil]);

  // Derive isRunning from shared context — true when context has an active session for this device
  const isRunning = Boolean(runtimeState?.isRunning || (sessionCtx.isRunning && sessionCtx.activeDeviceId === deviceId));

  // Apply AI action: adjust temperature/fan based on ML recommendation
  const applyAIAction = useCallback(async (prediction: AIPrediction, currentTemp: number, currentFan: number) => {
    if (!deviceId) return;
    const action = prediction.action;
    if (action === 'MAINTAIN' || action === 'STOP') return;

    let newTemp = currentTemp;
    let newFan = currentFan;

    if (action === 'REDUCE_TEMP') {
      newTemp = Math.max(35, currentTemp - 5);
    } else if (action === 'INCREASE_TEMP') {
      newTemp = Math.min(65, currentTemp + 5);
    } else if (action === 'INCREASE_FAN') {
      newFan = Math.min(100, currentFan + 15);
    }

    if (newTemp === currentTemp && newFan === currentFan) return;

    setTemperature(newTemp);
    setFanSpeed(newFan);

    try {
      await grainApi.dryer.start(deviceId, DryerMode.Auto, newTemp, newFan);
    } catch { /* silent — next poll will retry */ }
  }, [deviceId]);

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
          const prediction: AIPrediction = {
            predictedMoisture30min: result.predictedMoisture30min,
            estimatedMinutesToTarget: result.estimatedMinutesToTarget,
            recommendation: result.recommendation,
            recommendationType: result.recommendationType,
            action: (result.action ?? 'MAINTAIN') as AIPrediction['action'],
            efficiencyScore: result.efficiencyScore,
            confidence: result.confidence,
            isDryingComplete: result.isDryingComplete,
            projectedMoistureCurve: result.projectedCurve,
            targetMoisture: result.targetMoisture,
            algorithm: result.algorithm,
          };
          setAiPrediction(prediction);
          if (result.isDryingComplete && !aiAutoStopped) {
            await autoStopDryer();
          } else {
            await applyAIAction(prediction, input.temperature, input.fanSpeed);
          }
        } catch {
          const result = runPrediction(input);
          setAiPrediction(result);
          if (result.isDryingComplete && !aiAutoStopped) {
            await autoStopDryer();
          } else {
            await applyAIAction(result, input.temperature, input.fanSpeed);
          }
        }
      } catch {
        // Sensor fetch failed
      } finally {
        setAiLoading(false);
      }
    };

    fetchAIPrediction();
    const interval = setInterval(fetchAIPrediction, DRYING.AI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode, isRunning, deviceId, aiAutoStopped]);

  const autoStopDryer = useCallback(async () => {
    if (!deviceId) return;
    setAiAutoStopped(true);
    const ok = await sessionCtx.stopDrying('complete');
    if (ok) {
      showToast('Drying complete — dryer stopped by AI', 'success');
    } else {
      const msg = sessionCtx.error || 'Failed to auto-stop dryer';
      setError(msg);
      showToast(msg, 'error');
    }
  }, [deviceId, sessionCtx, showToast]);

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
          setSyncingUntil(Date.now() + DRYING.SYNC_WINDOW_MS);
          try {
            const ok = await sessionCtx.stopDrying('complete');
            if (ok) {
              showToast('Dryer stopped successfully', 'success');
            } else {
              const msg = sessionCtx.error || 'Failed to stop dryer';
              if (isNetworkError({ status: 0 })) {
                await enqueueCommand({ id: `${Date.now()}-stop`, deviceId, type: 'stop', payload: {}, queuedAt: Date.now() });
                showToast('Offline — stop command queued', 'warning');
              } else {
                showToast(msg, 'error');
              }
            }
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
      `Start drying cycle?\n\nDevice: ${deviceName}\nMode: ${mode === DryerMode.Auto ? 'AI Auto' : 'Manual'}\n${mode === DryerMode.Manual ? `Temp: ${temperature.toFixed(1)}°C\nFan: ${fanSpeed}%` : 'AI will adjust settings automatically'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          style: 'default',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsControlling(true);
            setAiAutoStopped(false);
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
                const msg = sessionCtx.error || 'Failed to start dryer';
                if (msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('connection')) {
                  await enqueueCommand({ id: `${Date.now()}-start`, deviceId, type: 'start', payload: { mode, temperature, fanSpeed }, queuedAt: Date.now() });
                  showToast('Offline — start command queued', 'warning');
                } else {
                  showToast(msg, 'error');
                }
              }
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
    aiAutoStopped,
    aiPrediction,
    aiLoading,
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
