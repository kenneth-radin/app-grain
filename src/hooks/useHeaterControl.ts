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
  preset: (state: 'ON' | 'OFF') => void;
  isLoading: boolean;
  error: string | null;
};

interface HeaterRuntimeHints {
  heaterState?: string;
  lastHeartbeat?: number;
  pendingCommand?: string | null;
}

const PENDING_COMMAND_STALE_MS = 15000;

export function useHeaterControl(
  deviceId: string | undefined,
  setSyncingUntil?: (ms: number | null) => void,
  commandAck = false,
  commandTimeout = false,
  runtimeState?: HeaterRuntimeHints | null,
): UseHeaterControlReturn {
  const { showToast } = useToastContext();
  const [heaterStatus, setHeaterStatus] = useState<'ON' | 'OFF'>('OFF');
  const [heaterLoading, setHeaterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const optimisticRef = useRef<'ON' | 'OFF' | null>(null);
  const pendingSinceRef = useRef<number | null>(null);
  // Safety net: if the device never ACKs (and the shared commandTimeout never
  // fires), clear loading + unblock buttons anyway so the UI can't hang forever.
  const FALLBACK_CLEAR_MS = 15000;
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearFallbackTimer(), [clearFallbackTimer]);

  useEffect(() => {
    if (commandAck) {
      optimisticRef.current = null;
      clearFallbackTimer();
      setHeaterLoading(false);
      inFlightRef.current = false;
    }
  }, [commandAck, clearFallbackTimer]);

  useEffect(() => {
    if (commandTimeout && optimisticRef.current) {
      setHeaterStatus(optimisticRef.current);
      optimisticRef.current = null;
    }
    if (commandTimeout) {
      clearFallbackTimer();
      setHeaterLoading(false);
      inFlightRef.current = false;
    }
  }, [commandTimeout, clearFallbackTimer]);

  // Sync local toggle from the device's actual heater state (Firebase runtimeState).
  // A stale pendingCommand must never block syncing permanently.
  useEffect(() => {
    if (runtimeState?.pendingCommand) {
      if (pendingSinceRef.current === null) pendingSinceRef.current = Date.now();
    } else {
      pendingSinceRef.current = null;
    }
    const pendingFresh =
      !!runtimeState?.pendingCommand &&
      pendingSinceRef.current !== null &&
      Date.now() - pendingSinceRef.current < PENDING_COMMAND_STALE_MS;

    // Once the device reports the state we optimistically set, release the hold.
    if (!pendingFresh && !inFlightRef.current && optimisticRef.current &&
        (runtimeState?.heaterState == null || runtimeState.heaterState === heaterStatus)) {
      optimisticRef.current = null;
    }

    if (inFlightRef.current || optimisticRef.current) return;
    if (pendingFresh) return;
    const h = runtimeState?.heaterState;
    if (h === 'ON' || h === 'OFF') setHeaterStatus(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeState?.heaterState, runtimeState?.lastHeartbeat, runtimeState?.pendingCommand]);

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
      // Safety net: even if the device never ACKs, stop showing loading and
      // re-enable the buttons after a fixed window.
      clearFallbackTimer();
      fallbackTimerRef.current = setTimeout(() => {
        optimisticRef.current = null;
        setHeaterLoading(false);
        inFlightRef.current = false;
      }, FALLBACK_CLEAR_MS);
    } catch {
      clearFallbackTimer();
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

  const preset = useCallback((state: 'ON' | 'OFF') => {
    setHeaterStatus(state);
  }, []);

  return {
    heaterStatus,
    heaterLoading,
    heaterOn,
    heaterOff,
    preset,
    isLoading: heaterLoading,
    error,
  };
}
