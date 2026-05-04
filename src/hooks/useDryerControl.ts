import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { grainApi, isNetworkError } from '@/api';
import type { Device } from '@/api';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useRealtimeSensor } from './useRealtimeSensor';
import { useToastContext } from '@/context/ToastContext';
import { useAIPrediction, runPrediction } from './useAIPrediction';
import type { SensorInput, AIPrediction } from './useAIPrediction';
import { DRYING } from '@/utils/constants';
import { DryerMode, DryerStatus, StorageKeys } from '@/utils/enums';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueCommand } from '@/utils/commandQueue';

const PERSIST_KEYS = [
  StorageKeys.ControlMode,
  StorageKeys.ControlIsRunning,
  StorageKeys.ControlTemperature,
  StorageKeys.ControlFanSpeed,
  StorageKeys.ControlSelectedDeviceId,
];

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

  const [mode, setMode] = useState<DryerMode>(DryerMode.Auto);
  const [isRunning, setIsRunning] = useState(false);
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
  const { commandAcknowledged } = useRealtimeSensor(deviceId);

  // Restore persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const keys = [
          StorageKeys.ControlMode,
          StorageKeys.ControlIsRunning,
          StorageKeys.ControlTemperature,
          StorageKeys.ControlFanSpeed,
          StorageKeys.ControlSelectedDeviceId,
        ];
        const saved = await AsyncStorage.multiGet(keys);
        const map = Object.fromEntries(saved);
        if (map[StorageKeys.ControlMode]) setMode(map[StorageKeys.ControlMode] as DryerMode);
        if (map[StorageKeys.ControlIsRunning] === 'true') setIsRunning(true);
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
      [StorageKeys.ControlIsRunning, String(isRunning)],
      [StorageKeys.ControlTemperature, String(temperature)],
      [StorageKeys.ControlFanSpeed, String(fanSpeed)],
      [StorageKeys.ControlSelectedDeviceId, selectedDevice?.deviceId || ''],
    ]).catch(() => {});
  }, [restored, mode, isRunning, temperature, fanSpeed, selectedDevice]);

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
          if (result.isDryingComplete && !aiAutoStopped) {
            await autoStopDryer();
          }
        } catch {
          const result = runPrediction(input);
          setAiPrediction(result);
          if (result.isDryingComplete && !aiAutoStopped) {
            await autoStopDryer();
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
    try {
      await grainApi.dryer.stop(deviceId);
      setIsRunning(false);
      Alert.alert('Drying Complete', 'Drying complete — dryer stopped by AI');
    } catch (err: any) {
      console.error('AI auto-stop failed:', err);
    }
  }, [deviceId]);

  const handleStopDryer = useCallback(() => {
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
          setIsRunning(false);
          setSyncingUntil(Date.now() + DRYING.SYNC_WINDOW_MS);
          try {
            const restPromise = grainApi.dryer.stop(deviceId);
            const fbPromise = db ? set(ref(db, `grain/commands/${deviceId}/pending/latest`), {
              command: 'STOP',
              timestamp: Date.now(),
            }) : Promise.reject(new Error('Firebase database not initialized'));
            const results = await Promise.allSettled([restPromise, fbPromise]);
            const [restResult, fbResult] = results;

            if (restResult.status === 'fulfilled' && fbResult.status === 'fulfilled') {
              showToast('Dryer stopped successfully', 'success');
            } else if (restResult.status === 'fulfilled' && fbResult.status === 'rejected') {
              console.warn('[Firebase] Dual-write stop failed:', fbResult.reason);
              showToast('Dryer stopped — Firebase sync failed', 'warning');
            } else if (restResult.status === 'rejected' && fbResult.status === 'fulfilled') {
              setIsRunning(true);
              if (isNetworkError(restResult.reason)) {
                await enqueueCommand({ id: `${Date.now()}-stop`, deviceId: deviceId!, type: 'stop', payload: {}, queuedAt: Date.now() });
                showToast('Offline — stop command queued', 'warning');
              } else {
                Alert.alert('Error', restResult.reason?.message || 'Failed to stop dryer');
                showToast(restResult.reason?.message || 'Failed to stop dryer', 'error');
              }
            } else {
              setIsRunning(true);
              if (restResult.status === 'rejected' && isNetworkError(restResult.reason)) {
                await enqueueCommand({ id: `${Date.now()}-stop`, deviceId: deviceId!, type: 'stop', payload: {}, queuedAt: Date.now() });
                showToast('Offline — stop command queued (Firebase also failed)', 'warning');
              } else if (restResult.status === 'rejected') {
                Alert.alert('Error', restResult.reason?.message || 'Failed to stop dryer');
                showToast('REST & Firebase both failed', 'error');
              } else {
                Alert.alert('Error', 'Failed to stop dryer');
                showToast('REST & Firebase both failed', 'error');
              }
            }
          } finally {
            setIsControlling(false);
          }
        },
      },
    ]);
  }, [deviceId, showToast]);

  const handleStartDryer = useCallback(() => {
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
            setIsRunning(true);
            setAiAutoStopped(false);
            setSyncingUntil(Date.now() + DRYING.SYNC_WINDOW_MS);
            try {
              const restPromise = grainApi.dryer.start(deviceId, mode, temperature, fanSpeed);
              const fbPromise = db ? set(ref(db, `grain/commands/${deviceId}/pending/latest`), {
                command: 'START', mode, temperature, fanSpeed,
                timestamp: Date.now(),
              }) : Promise.reject(new Error('Firebase database not initialized'));
              const results = await Promise.allSettled([restPromise, fbPromise]);
              const [restResult, fbResult] = results;

              if (restResult.status === 'fulfilled' && fbResult.status === 'fulfilled') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast('Dryer started successfully', 'success');
              } else if (restResult.status === 'fulfilled' && fbResult.status === 'rejected') {
                console.warn('[Firebase] Dual-write start failed:', fbResult.reason);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast('Dryer started — Firebase sync failed', 'warning');
              } else if (restResult.status === 'rejected' && fbResult.status === 'fulfilled') {
                setIsRunning(false);
                if (isNetworkError(restResult.reason)) {
                  await enqueueCommand({ id: `${Date.now()}-start`, deviceId: deviceId!, type: 'start', payload: { mode, temperature, fanSpeed }, queuedAt: Date.now() });
                  showToast('Offline — start command queued', 'warning');
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  showToast(restResult.reason?.message || 'Failed to start dryer', 'error');
                }
              } else {
                setIsRunning(false);
                if (restResult.status === 'rejected' && isNetworkError(restResult.reason)) {
                  await enqueueCommand({ id: `${Date.now()}-start`, deviceId: deviceId!, type: 'start', payload: { mode, temperature, fanSpeed }, queuedAt: Date.now() });
                  showToast('Offline — start command queued (Firebase also failed)', 'warning');
                } else if (restResult.status === 'rejected') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  showToast('REST & Firebase both failed', 'error');
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  showToast('REST & Firebase both failed', 'error');
                }
              }
            } finally {
              setIsControlling(false);
            }
          },
        },
      ],
    );
  }, [deviceId, selectedDevice, mode, temperature, fanSpeed, showToast]);

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
