import { useState, useEffect, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { grainApi } from '@/api';
import { useToastContext } from '@/context/ToastContext';
import { StorageKeys } from '@/utils/enums';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FanControlState {
  fan1Status: 'ON' | 'OFF';
  fan2Status: 'ON' | 'OFF';
  fan1Loading: boolean;
  fan2Loading: boolean;
  bothLoading: boolean;
  syncingUntil: number | null;
}

export type UseFanControlReturn = FanControlState & {
  controlFan: (action: 'ON' | 'OFF') => Promise<void>;
  controlFan2: (action: 'ON' | 'OFF') => Promise<void>;
  controlAllFans: (action: 'ON' | 'OFF') => Promise<void>;
  handleFanControl: (fan: 'FAN1' | 'FAN2' | 'ALL', action: 'ON' | 'OFF') => Promise<void>;
  setSyncingUntil: (ms: number | null) => void;
  isLoading: boolean;
  error: string | null;
};

interface DeviceRuntimeHints {
  fan1State?: string;
  fan2State?: string;
  lastHeartbeat?: number;
  pendingCommand?: string | null;
}

export function useFanControl(
  deviceId: string | undefined,
  syncingUntil: number | null,
  setSyncingUntil: (ms: number | null) => void,
  commandAck = false,
  commandTimeout = false,
  runtimeState?: DeviceRuntimeHints | null,
): UseFanControlReturn {
  const { showToast } = useToastContext();

  const [fan1Status, setFan1Status] = useState<'ON' | 'OFF'>('OFF');
  const [fan2Status, setFan2Status] = useState<'ON' | 'OFF'>('OFF');
  const [fan1Loading, setFan1Loading] = useState(false);
  const [fan2Loading, setFan2Loading] = useState(false);
  const [bothLoading, setBothLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const optimisticRef = useRef<{ fan1: 'ON' | 'OFF'; fan2: 'ON' | 'OFF' } | null>(null);

  // Restore persisted fan state on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.multiGet([
          StorageKeys.ControlFan1Status,
          StorageKeys.ControlFan2Status,
        ]);
        const map = Object.fromEntries(saved);
        if (map[StorageKeys.ControlFan1Status]) setFan1Status(map[StorageKeys.ControlFan1Status] as 'ON' | 'OFF');
        if (map[StorageKeys.ControlFan2Status]) setFan2Status(map[StorageKeys.ControlFan2Status] as 'ON' | 'OFF');
      } catch {
        // Silent — state will use defaults
      }
    })();
  }, []);

  // Sync local toggles from the device's actual relay state (Firebase runtimeState).
  // Skipped while a command is in flight so optimistic UI is not clobbered.
  useEffect(() => {
    if (inFlightRef.current || optimisticRef.current) return;
    if (runtimeState?.pendingCommand) return;
    const f1 = runtimeState?.fan1State;
    const f2 = runtimeState?.fan2State;
    if ((f1 === 'ON' || f1 === 'OFF') && f1 !== fan1Status) setFan1Status(f1);
    if ((f2 === 'ON' || f2 === 'OFF') && f2 !== fan2Status) setFan2Status(f2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeState?.fan1State, runtimeState?.fan2State, runtimeState?.lastHeartbeat]);

  // Persist fan state on change
  useEffect(() => {
    AsyncStorage.multiSet([
      [StorageKeys.ControlFan1Status, fan1Status],
      [StorageKeys.ControlFan2Status, fan2Status],
    ]).catch(() => {});
  }, [fan1Status, fan2Status]);

  useEffect(() => {
    if (commandAck) {
      optimisticRef.current = null;
      setFan1Loading(false);
      setFan2Loading(false);
      setBothLoading(false);
      inFlightRef.current = false;
    }
  }, [commandAck]);

  useEffect(() => {
    if (commandTimeout && optimisticRef.current) {
      setFan1Status(optimisticRef.current.fan1);
      setFan2Status(optimisticRef.current.fan2);
      optimisticRef.current = null;
    }
    if (commandTimeout) {
      setFan1Loading(false);
      setFan2Loading(false);
      setBothLoading(false);
      inFlightRef.current = false;
    }
  }, [commandTimeout]);

  const handleFanControl = useCallback(async (fan: 'FAN1' | 'FAN2' | 'ALL', action: 'ON' | 'OFF') => {
    if (!deviceId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    optimisticRef.current = { fan1: fan1Status, fan2: fan2Status };
    if (fan === 'FAN1' || fan === 'ALL') setFan1Status(action);
    if (fan === 'FAN2' || fan === 'ALL') setFan2Status(action);
    setSyncingUntil(Date.now() + 15000);

    if (fan === 'FAN1') setFan1Loading(true);
    if (fan === 'FAN2') setFan2Loading(true);
    if (fan === 'ALL') setBothLoading(true);

    try {
      await grainApi.dryer.controlFan(deviceId, fan, action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const label = fan === 'ALL' ? 's' : fan === 'FAN1' ? '1' : '2';
      showToast(`Fan ${label} turned ${action.toLowerCase()}`, 'success');
    } catch {
      if (optimisticRef.current) {
        setFan1Status(optimisticRef.current.fan1);
        setFan2Status(optimisticRef.current.fan2);
        optimisticRef.current = null;
      }
      setSyncingUntil(null);
      setFan1Loading(false);
      setFan2Loading(false);
      setBothLoading(false);
      inFlightRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to control fan. Try again.', 'error');
      setError('Failed to control fan');
    }
  }, [deviceId, showToast, setSyncingUntil, fan1Status, fan2Status]);

  const controlFan = useCallback((action: 'ON' | 'OFF') => {
    return handleFanControl('FAN1', action);
  }, [handleFanControl]);

  const controlFan2 = useCallback((action: 'ON' | 'OFF') => {
    return handleFanControl('FAN2', action);
  }, [handleFanControl]);

  const controlAllFans = useCallback((action: 'ON' | 'OFF') => {
    return handleFanControl('ALL', action);
  }, [handleFanControl]);

  return {
    fan1Status,
    fan2Status,
    fan1Loading,
    fan2Loading,
    bothLoading,
    syncingUntil,
    controlFan,
    controlFan2,
    controlAllFans,
    handleFanControl,
    setSyncingUntil,
    isLoading: false,
    error,
  };
}
