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
  getLastError: () => string | null;
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
  getLastError: () => null,
});

export function DryingSessionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [activeSession, setActiveSession] = useState<DryingSession | null>(null);
  const [sessions, setSessions] = useState<DryingSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorRef = useRef<string | null>(null);

  const setSessionError = useCallback((message: string | null) => {
    errorRef.current = message;
    setError(message);
  }, []);

  const setSessionsIfChanged = useCallback((next: DryingSession[]) => {
    setSessions(prev => {
      if (
        prev.length === next.length &&
        prev.every((session, index) =>
          session._id === next[index]?._id &&
          session.status === next[index]?.status &&
          session.currentMoisture === next[index]?.currentMoisture &&
          session.updatedAt === next[index]?.updatedAt
        )
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const setActiveSessionIfChanged = useCallback((next: DryingSession | null) => {
    setActiveSession(prev => {
      if (
        prev?._id === next?._id &&
        prev?.status === next?.status &&
        prev?.currentMoisture === next?.currentMoisture &&
        prev?.updatedAt === next?.updatedAt
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const isRunning = activeSession?.status === 'active';
  const activeDeviceId = activeSession?.deviceId ?? null;

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setSessionError(null);
      const [sessionsRes, active] = await Promise.all([
        grainApi.sessions.list({ limit: 20 }),
        grainApi.sessions.getActive(),
      ]);
      setSessionsIfChanged(sessionsRes.data);
      setActiveSessionIfChanged(active);
    } catch (err) {
      if (!isNetworkError(err)) {
        setSessionError(err instanceof Error ? err.message : 'Failed to load sessions');
      }
    } finally {
      setIsLoading(false);
    }
  }, [setActiveSessionIfChanged, setSessionsIfChanged]);

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
      setIsLoading(true);
      setSessionError(null);

      // Queue the hardware command first. A session should not appear active
      // unless the backend accepted the command for ESP polling.
      try {
        await grainApi.dryer.start(
          opts.deviceId,
          opts.mode ?? DryerMode.Auto,
          opts.temperature,
          opts.fanSpeed,
        );
      } catch (cmdErr) {
        const msg = isNetworkError(cmdErr)
          ? 'Server unavailable — start command was not queued.'
          : (cmdErr instanceof Error ? cmdErr.message : 'Failed to queue start command');
        console.warn('[DryingSessionContext] dryer start command failed:', cmdErr);
        setSessionError(msg);
        return null;
      }

      // Start the session record only after the command is accepted.
      let session: DryingSession;
      try {
        session = await grainApi.sessions.start({
          deviceId: opts.deviceId,
          grainType: opts.grainType,
          targetMoisture: opts.targetMoisture,
        });
      } catch (sessionErr) {
        const msg = 'Drying started but session tracking failed. Please check Sessions tab.';
        console.warn('[DryingSessionContext] session creation failed after dryer start:', sessionErr);
        setSessionError(msg);
        return null;
      }

      setActiveSessionIfChanged(session);
      setSessions(prev => [session, ...prev.filter(s => s._id !== session._id)]);
      void fetchSessions();
      return session;
    } catch (err) {
      const msg = isNetworkError(err)
        ? 'Server unavailable — check your connection.'
        : (err instanceof Error ? err.message : 'Failed to start drying session');
      setSessionError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchSessions, setActiveSessionIfChanged, setSessionError]);

  const stopDrying = useCallback(async (action: 'complete' | 'abort' = 'complete'): Promise<boolean> => {
    if (!activeSession) return false;
    try {
      setIsLoading(true);
      setSessionError(null);

      // Queue STOP first so the UI does not complete a session while the
      // prototype continues running.
      try {
        await grainApi.dryer.stop(activeSession.deviceId);
      } catch (cmdErr) {
        const msg = isNetworkError(cmdErr)
          ? 'Server unavailable — stop command was not queued.'
          : (cmdErr instanceof Error ? cmdErr.message : 'Failed to queue stop command');
        console.warn('[DryingSessionContext] dryer stop command failed:', cmdErr);
        setSessionError(msg);
        return false;
      }

      // End the session record
      const updated = await grainApi.sessions.end(activeSession._id, action);
      setActiveSessionIfChanged(null);
      setSessions(prev => prev.map(s => s._id === updated._id ? updated : s));
      return true;
    } catch (err) {
      const msg = isNetworkError(err)
        ? 'Server unavailable — check your connection.'
        : (err instanceof Error ? err.message : 'Failed to stop drying session');
      setSessionError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, setActiveSessionIfChanged, setSessionError]);

  const clearError = useCallback(() => setSessionError(null), [setSessionError]);
  const getLastError = useCallback(() => errorRef.current, []);

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
      getLastError,
    }}>
      {children}
    </DryingSessionContext.Provider>
  );
}

export function useDryingSession() {
  return useContext(DryingSessionContext);
}

export default DryingSessionContext;
