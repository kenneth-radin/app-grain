import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { grainApi, isNetworkError } from '@/api';
import type { DryingSession } from '@/api';
import { DryerMode } from '@/utils/enums';
import { useAuth } from '@/context/AuthContext';

interface StartSessionOptions {
  deviceId: string;
  grainType?: string;
  targetMoisture?: number;
  mode?: DryerMode;
  temperature?: number;
  fanSpeed?: number;
}

interface DryingSessionContextType {
  activeSession: DryingSession | null;
  sessions: DryingSession[];
  isLoading: boolean;
  error: string | null;
  isRunning: boolean;
  activeDeviceId: string | null;
  startDrying: (opts: StartSessionOptions) => Promise<DryingSession | null>;
  stopDrying: (action?: 'complete' | 'abort') => Promise<boolean>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

const DryingSessionContext = createContext<DryingSessionContextType>({
  activeSession: null,
  sessions: [],
  isLoading: false,
  error: null,
  isRunning: false,
  activeDeviceId: null,
  startDrying: async () => null,
  stopDrying: async () => false,
  refetch: async () => {},
  clearError: () => {},
});

export function DryingSessionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [activeSession, setActiveSession] = useState<DryingSession | null>(null);
  const [sessions, setSessions] = useState<DryingSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = activeSession?.status === 'active';
  const activeDeviceId = activeSession?.deviceId ?? null;

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [sessionsRes, active] = await Promise.all([
        grainApi.sessions.list({ limit: 20 }),
        grainApi.sessions.getActive(),
      ]);
      setSessions(sessionsRes.data);
      setActiveSession(active);
    } catch (err) {
      if (!isNetworkError(err)) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Only fetch once authenticated — prevents 401 loop on startup
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchSessions();
  }, [isAuthenticated, fetchSessions]);

  // Poll active session every 15s when one is running
  useEffect(() => {
    if (!isAuthenticated || !activeSession) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const updated = await grainApi.sessions.getActive(activeSession.deviceId);
        setActiveSession(updated);
        if (!updated) {
          // Session ended externally — refresh list
          setSessions(prev => prev.map(s =>
            s._id === activeSession._id ? { ...s, status: 'completed' as const } : s
          ));
        }
      } catch { /* silent — keep showing last known state */ }
    }, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, activeSession?._id]);

  const startDrying = useCallback(async (opts: StartSessionOptions): Promise<DryingSession | null> => {
    try {
      setError(null);
      // Start the session record
      const session = await grainApi.sessions.start({
        deviceId: opts.deviceId,
        grainType: opts.grainType,
        targetMoisture: opts.targetMoisture,
      });
      // Fire dryer start command (best-effort — session already created)
      try {
        await grainApi.dryer.start(
          opts.deviceId,
          opts.mode ?? DryerMode.Auto,
          opts.temperature,
          opts.fanSpeed,
        );
      } catch (cmdErr) {
        if (!isNetworkError(cmdErr)) {
          console.warn('[DryingSessionContext] dryer start command failed:', cmdErr);
        }
      }
      setActiveSession(session);
      setSessions(prev => [session, ...prev.filter(s => s._id !== session._id)]);
      return session;
    } catch (err) {
      const msg = isNetworkError(err)
        ? 'Server unavailable — check your connection.'
        : (err instanceof Error ? err.message : 'Failed to start drying session');
      setError(msg);
      return null;
    }
  }, []);

  const stopDrying = useCallback(async (action: 'complete' | 'abort' = 'complete'): Promise<boolean> => {
    if (!activeSession) return false;
    try {
      setError(null);
      // Fire dryer stop command (best-effort)
      try {
        await grainApi.dryer.stop(activeSession.deviceId);
      } catch (cmdErr) {
        if (!isNetworkError(cmdErr)) {
          console.warn('[DryingSessionContext] dryer stop command failed:', cmdErr);
        }
      }
      // End the session record
      const updated = await grainApi.sessions.end(activeSession._id, action);
      setActiveSession(null);
      setSessions(prev => prev.map(s => s._id === updated._id ? updated : s));
      return true;
    } catch (err) {
      const msg = isNetworkError(err)
        ? 'Server unavailable — check your connection.'
        : (err instanceof Error ? err.message : 'Failed to stop drying session');
      setError(msg);
      return false;
    }
  }, [activeSession]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <DryingSessionContext.Provider value={{
      activeSession,
      sessions,
      isLoading,
      error,
      isRunning,
      activeDeviceId,
      startDrying,
      stopDrying,
      refetch: fetchSessions,
      clearError,
    }}>
      {children}
    </DryingSessionContext.Provider>
  );
}

export function useDryingSession() {
  return useContext(DryingSessionContext);
}

export default DryingSessionContext;
