import { useCallback, useState } from 'react';
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

export function useHeaterControl(deviceId: string | undefined): UseHeaterControlReturn {
  const { showToast } = useToastContext();
  const [heaterStatus, setHeaterStatus] = useState<'ON' | 'OFF'>('OFF');
  const [heaterLoading, setHeaterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleHeaterControl = useCallback(async (action: 'ON' | 'OFF') => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const previousStatus = heaterStatus;
    setHeaterStatus(action);
    setHeaterLoading(true);
    setError(null);

    try {
      await grainApi.dryer.controlHeater(deviceId, action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Heater turned ${action.toLowerCase()}`, 'success');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to control heater. Try again.', 'error');
      setHeaterStatus(previousStatus);
      setError('Failed to control heater');
    } finally {
      setHeaterLoading(false);
    }
  }, [deviceId, heaterStatus, showToast]);

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
