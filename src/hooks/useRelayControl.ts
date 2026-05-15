import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { grainApi } from '@/api';
import { useToastContext } from '@/context/ToastContext';

export interface RelayControlState {
  relayStatus: 'ON' | 'OFF';
  relayLoading: boolean;
}

export type UseRelayControlReturn = RelayControlState & {
  relayOn: () => Promise<void>;
  relayOff: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export function useRelayControl(deviceId: string | undefined): UseRelayControlReturn {
  const { showToast } = useToastContext();
  const [relayStatus, setRelayStatus] = useState<'ON' | 'OFF'>('OFF');
  const [relayLoading, setRelayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const handleRelayControl = useCallback(async (action: 'ON' | 'OFF') => {
    if (!deviceId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setRelayLoading(true);
    setError(null);

    try {
      await grainApi.dryer.controlRelay(deviceId, action);
      setRelayStatus(action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Auger / Conveyor turned ${action.toLowerCase()}`, 'success');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to control auger / conveyor. Try again.', 'error');
      setError('Failed to control relay');
    } finally {
      setRelayLoading(false);
      inFlightRef.current = false;
    }
  }, [deviceId, showToast]);

  const relayOn = useCallback(() => handleRelayControl('ON'), [handleRelayControl]);
  const relayOff = useCallback(() => handleRelayControl('OFF'), [handleRelayControl]);

  return {
    relayStatus,
    relayLoading,
    relayOn,
    relayOff,
    isLoading: relayLoading,
    error,
  };
}
