import { useDryingSession } from '@/context/DryingSessionContext';
import type { DryingSession } from '@/api';

interface UseDryingSessionsReturn {
  sessions: DryingSession[];
  activeSession: DryingSession | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  startSession: (deviceId: string, grainType?: string, targetMoisture?: number) => Promise<DryingSession | null>;
  endSession: (sessionId: string, action: 'complete' | 'abort') => Promise<boolean>;
}

export function useDryingSessions(_deviceId?: string): UseDryingSessionsReturn {
  const ctx = useDryingSession();

  const startSession = async (
    deviceId: string,
    grainType?: string,
    targetMoisture?: number,
  ): Promise<DryingSession | null> => {
    return ctx.startDrying({ deviceId, grainType, targetMoisture });
  };

  const endSession = async (
    _sessionId: string,
    action: 'complete' | 'abort',
  ): Promise<boolean> => {
    return ctx.stopDrying(action);
  };

  return {
    sessions: ctx.sessions,
    activeSession: ctx.activeSession,
    isLoading: ctx.isLoading,
    error: ctx.error,
    refetch: ctx.refetch,
    startSession,
    endSession,
  };
}
