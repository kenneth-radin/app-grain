import { useCallback, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { grainApi } from '@/api';
import { useToastContext } from '@/context/ToastContext';

type StepperAction = 'START' | 'STOP' | 'CW' | 'CCW';

export interface StepperControlState {
  stepperLoading: boolean;
  stepperAction: StepperAction | null;
}

export type UseStepperControlReturn = StepperControlState & {
  stepperStart: () => Promise<void>;
  stepperStop: () => Promise<void>;
  stepperCW: () => Promise<void>;
  stepperCCW: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export function useStepperControl(deviceId: string | undefined): UseStepperControlReturn {
  const { showToast } = useToastContext();
  const [stepperLoading, setStepperLoading] = useState(false);
  const [stepperAction, setStepperAction] = useState<StepperAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStepperControl = useCallback(async (action: StepperAction) => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStepperLoading(true);
    setStepperAction(action);
    setError(null);

    try {
      await grainApi.dryer.controlStepper(deviceId, action);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Stepper ${action.toLowerCase()} command sent`, 'success');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to control stepper. Try again.', 'error');
      setError('Failed to control stepper');
    } finally {
      setStepperLoading(false);
      setStepperAction(null);
    }
  }, [deviceId, showToast]);

  const stepperStart = useCallback(() => handleStepperControl('START'), [handleStepperControl]);
  const stepperStop = useCallback(() => handleStepperControl('STOP'), [handleStepperControl]);
  const stepperCW = useCallback(() => handleStepperControl('CW'), [handleStepperControl]);
  const stepperCCW = useCallback(() => handleStepperControl('CCW'), [handleStepperControl]);

  return {
    stepperLoading,
    stepperAction,
    stepperStart,
    stepperStop,
    stepperCW,
    stepperCCW,
    isLoading: stepperLoading,
    error,
  };
}
