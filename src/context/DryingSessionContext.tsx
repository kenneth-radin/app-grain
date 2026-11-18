import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { grainApi, isNetworkError } from '@/api';
import type { DryingSession } from '@/api';
import { DryerMode } from '@/utils/enums';
import { useAuth } from '@/context/AuthContext';
import { useToastContext } from './ToastContext';

interface StartSessionOptions {
  deviceId: string;
  grainType?: string;
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
  const { showToast } = useToastContext();
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

  // Only fetch once authenticated â€” prevents 401 loop on startup
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
          // Session ended externally â€” refresh list
          setSessions(prev => prev.map(s =>
            s._id === activeSession._id ? { ...s, status: 'completed' as const } : s
          ));
        }
      } catch { /* silent â€” keep showing last known state */ }
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
      const effectiveMode = opts.mode ?? DryerMode.Auto;
      try {
        await grainApi.dryer.start(
          opts.deviceId,
          effectiveMode,
          opts.temperature,
          opts.fanSpeed,
        );
      } catch (cmdErr) {
        const msg = isNetworkError(cmdErr)
          ? 'Server unavailable â€” start command was not queued.'
          : (cmdErr instanceof Error ? cmdErr.message : 'Failed to queue start command');
        console.warn('[DryingSessionContext] dryer start command failed:', cmdErr);
        setSessionError(msg);
        return null;
      }

      // MANUAL mode: the hardware turns fans/heater ON per the temp/fan settings
      // at START. Button toggles mirror real output state via runtimeState sync.

      // Start the session record only after the command is accepted.
      // Retries with backoff; on conflict (stuck active session from an
      // earlier failed run) it aborts the orphaned session and retries —
      // self-healing instead of failing forever.
      const sessionPayload = { deviceId: opts.deviceId, grainType: opts.grainType };
      const describe = (e: unknown): string => {
        const anyErr = e as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
        return anyErr?.response?.data?.message || anyErr?.response?.data?.error || anyErr?.message || 'unknown error';
      };
      let session: DryingSession | null = null;
      let sessionErr: unknown = null;
      for (let attempt = 0; attempt < 3 && !session; attempt++) {
        try {
          session = await grainApi.sessions.start(sessionPayload);
        } catch (err) {
          sessionErr = err;
          // The API client normalizes axios errors into plain Errors carrying
          // `.status` (not `.response.status`), so read both defensively.
          const errObj = err as { response?: { status?: number }; status?: number };
          const status = errObj?.response?.status ?? errObj?.status;
          console.warn(`[DryingSessionContext] session create attempt ${attempt + 1} failed:`, describe(err));
          if (status === 409 || status === 400 || /already|active|conflict/i.test(describe(err))) {
            // Recover from a stuck/orphaned active session for this device, then retry.
            try {
              const stuck = await grainApi.sessions.getActive(opts.deviceId);
              if (stuck) {
                console.warn('[DryingSessionContext] ending orphaned active session:', stuck._id);
                await grainApi.sessions.end(stuck._id, 'abort').catch(() => {});
                continue;
              }
            } catch { /* fall through to backoff */ }
          }
          if (attempt < 2) await new Promise(res => setTimeout(res, 1500));
        }
      }
      if (!session) {
        const detail = describe(sessionErr);
        const msg = `Drying command sent, but session tracking failed: ${detail}`;
        console.warn('[DryingSessionContext] session creation failed after dryer start:', sessionErr);
        setSessionError(msg);
        return null;
      }

      console.log('[DryingSessionContext] session created/returned:', {
        id: session._id,
        deviceId: session.deviceId,
        userId: session.userId,
        status: session.status,
      });

      setActiveSessionIfChanged(session);
      setSessions(prev => [session, ...prev.filter(s => s._id !== session._id)]);
      void fetchSessions();
      return session;
    } catch (err) {
      const msg = isNetworkError(err)
        ? 'Server unavailable â€” check your connection.'
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

      // Send STOP to the hardware first. If the server is truly unreachable we
      // cannot confirm anything, so abort without ending the record.
      let hardwareStopFailed = false;
      try {
        await grainApi.dryer.stop(activeSession.deviceId);
      } catch (cmdErr) {
        if (isNetworkError(cmdErr)) {
          const msg = 'Server unavailable â€” stop command was not queued.';
          console.warn('[DryingSessionContext] dryer stop command failed:', cmdErr);
          setSessionError(msg);
          return false;
        }
        // Server reachable but refused/failed the STOP: still end the session
        // so History always records it â€” warn that hardware may still run.
        hardwareStopFailed = true;
        console.warn('[DryingSessionContext] dryer stop refused, ending session anyway:', cmdErr);
      }

      // End the session record â€” this MUST happen so History captures the run.
      const updated = await grainApi.sessions.end(activeSession._id, action);
      setActiveSessionIfChanged(null);
      setSessions(prev => prev.map(s => s._id === updated._id ? updated : s));
      void fetchSessions();
      if (hardwareStopFailed) {
        showToast(`Session ${action === 'complete' ? 'completed' : 'aborted'} â€” but the dryer may still be running`, 'warning');
      }
      return true;
    } catch (err) {
      const msg = isNetworkError(err)
        ? 'Server unavailable â€” check your connection.'
        : (err instanceof Error ? err.message : 'Failed to stop drying session');
      setSessionError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, fetchSessions, setActiveSessionIfChanged, setSessionError, showToast]);

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
