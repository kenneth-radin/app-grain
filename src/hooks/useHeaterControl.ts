import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { grainApi } from '@/api';
import { useToastContext } from '@/context/ToastContext';

export interface HeaterControlState {
  heaterStatus: 'ON' | 'OFF';
  heaterLoading: boolean;
}

export type UseHeaterControlReturn = HeaterControlState & {
  heaterOn: () => Promise<void>;
  heaterOff: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export function useHeaterControl(
  deviceId: string | undefined,
  setSyncingUntil?: (ms: number | null) => void,
  commandAck = false,
  commandTimeout = false,
): UseHeaterControlReturn {
  const { showToast } = useToastContext();
  const [heaterStatus, setHeaterStatus] = useState<'ON' | 'OFF'>('OFF');
  const [heaterLoading, setHeaterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const optimisticRef = useRef<'ON' | 'OFF' | null>(null);

  useEffect(() => {
    if (commandAck) {
      optimisticRef.current = null;
      setHeaterLoading(false);
      inFlightRef.current = false;
    }
  }, [commandAck]);

  useEffect(() => {
    if (commandTimeout && optimisticRef.current) {
      setHeaterStatus(optimisticRef.current);
      optimisticRef.current = null;
    }
    if (commandTimeout) {
      setHeaterLoading(false);
      inFlightRef.current = false;
    }
  }, [commandTimeout]);

  const handleHeaterControl = useCallback(async (action: 'ON' | 'OFF') => {
    if (!deviceId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setHeaterLoading(true);
    setError(null);
    optimisticRef.current = heaterStatus;
    setHeaterStatus(action);
    setSyncingUntil?.(Date.now() + 15000);

    try {
      await grainApi.dryer.controlHeater(deviceId, action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Heater turned ${action.toLowerCase()}`, 'success');
    } catch {
      if (optimisticRef.current) {
        setHeaterStatus(optimisticRef.current);
        optimisticRef.current = null;
      }
      setSyncingUntil?.(null);
      setHeaterLoading(false);
      inFlightRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to control heater. Try again.', 'error');
      setError('Failed to control heater');
    }
  }, [deviceId, heaterStatus, setSyncingUntil, showToast]);

  const heaterOn = useCallback(() => handleHeaterControl('ON'), [handleHeaterControl]);
  const heaterOff = useCallback(() => handleHeaterControl('OFF'), [handleHeaterControl]);

  return {
    heaterStatus,
    heaterLoading,
    heaterOn,
    heaterOff,
    isLoading: heaterLoading,
    error,
  };
}
