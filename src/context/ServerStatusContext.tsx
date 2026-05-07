import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { grainApi, isNetworkError } from '@/api';
import { flushQueue, getQueueCount, onQueueCountChange } from '@/utils/commandQueue';

export type ServerStatus = 'online' | 'offline' | 'unreachable' | 'reconnecting';

interface ServerStatusContextType {
  isServerOnline: boolean;
  serverStatus: ServerStatus;
  queuedCommandCount: number;
  checkServerHealth: () => Promise<void>;
  reset: () => void;
}

const ServerStatusContext = createContext<ServerStatusContextType>({
  isServerOnline: true,
  serverStatus: 'online',
  queuedCommandCount: 0,
  checkServerHealth: async () => {},
  reset: () => {},
});

export function ServerStatusProvider({ children }: { children: React.ReactNode }) {
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('online');
  const [queuedCommandCount, setQueuedCommandCount] = useState(0);
  const prevOnlineRef = useRef(true);

  const checkServerHealth = useCallback(async () => {
    setServerStatus('reconnecting');
    try {
      const ok = await grainApi.health.ping();
      if (ok) {
        setIsServerOnline(true);
        setServerStatus('online');
      } else {
        setIsServerOnline(false);
        setServerStatus('unreachable');
      }
    } catch (err: unknown) {
      setIsServerOnline(false);
      const status = (err as any)?.status;
      if (status === 500 || status === 502 || status === 503) {
        setServerStatus('unreachable');
      } else if (isNetworkError(err)) {
        setServerStatus('offline');
      } else {
        setServerStatus('unreachable');
      }
    }
  }, []);

  // Flush queued commands when server comes back online
  useEffect(() => {
    if (isServerOnline && !prevOnlineRef.current) {
      flushQueue();
    }
    prevOnlineRef.current = isServerOnline;
  }, [isServerOnline]);

  // Event-driven queue count: get initial count + subscribe to changes
  useEffect(() => {
    getQueueCount().then(setQueuedCommandCount);
    const unsubscribe = onQueueCountChange((count) => {
      setQueuedCommandCount(count);
    });
    return unsubscribe;
  }, []);

  const reset = useCallback(() => {
    setIsServerOnline(true);
    setServerStatus('online');
    setQueuedCommandCount(0);
  }, []);

  return (
    <ServerStatusContext.Provider
      value={{ isServerOnline, serverStatus, queuedCommandCount, checkServerHealth, reset }}
    >
      {children}
    </ServerStatusContext.Provider>
  );
}

export const useServerStatusContext = () => useContext(ServerStatusContext);
export default ServerStatusContext;
