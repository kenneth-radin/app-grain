import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { grainApi, isNetworkError } from '@/api';
import type { User, Device, AlertItem } from '@/api';
import { useAuth } from '@/hooks';
import { flushQueue, getQueueCount } from '@/utils/commandQueue';

export type ServerStatus = 'online' | 'offline' | 'unreachable' | 'reconnecting';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  visible: boolean;
}

interface AppContextType {
  user: User | null;
  alerts: AlertItem[];
  devices: Device[];
  settings: any;
  isLoading: boolean;
  isServerOnline: boolean;
  serverStatus: ServerStatus;
  queuedCommandCount: number;
  toast: ToastState;
  handleLogout: () => Promise<void>;
  showToast: (message: string, type?: ToastState['type']) => void;
  hideToast: () => void;
  refreshData: () => Promise<void>;
  checkServerHealth: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  user: null,
  alerts: [],
  devices: [],
  settings: null,
  isLoading: false,
  isServerOnline: true,
  serverStatus: 'online',
  queuedCommandCount: 0,
  toast: { message: '', type: 'info', visible: false },
  handleLogout: async () => {},
  showToast: () => {},
  hideToast: () => {},
  refreshData: async () => {},
  checkServerHealth: async () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { logout: authLogout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('online');
  const [queuedCommandCount, setQueuedCommandCount] = useState(0);
  const prevOnlineRef = useRef(true);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', visible: false });

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await grainApi.auth.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      setUser(null);
      setAlerts([]);
      setDevices([]);
      setSettings(null);
      authLogout();
    }
  }, [authLogout]);

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
      if (isNetworkError(err)) {
        const status = (err as any).status;
        if (status === 502 || status === 503) {
          setServerStatus('unreachable');
        } else {
          setServerStatus('offline');
        }
      } else {
        setServerStatus('unreachable');
      }
    }
  }, []);

  // Flush queued commands when server comes back online
  useEffect(() => {
    if (isServerOnline && !prevOnlineRef.current) {
      flushQueue().then(() => getQueueCount().then(setQueuedCommandCount));
    }
    prevOnlineRef.current = isServerOnline;
  }, [isServerOnline]);

  // Keep queued count updated
  useEffect(() => {
    if (!isServerOnline) {
      getQueueCount().then(setQueuedCommandCount);
      const interval = setInterval(() => getQueueCount().then(setQueuedCommandCount), 5000);
      return () => clearInterval(interval);
    }
  }, [isServerOnline]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [userData, devicesData] = await Promise.allSettled([
        grainApi.auth.getCurrentUser(),
        grainApi.devices.list(),
      ]);

      if (userData.status === 'fulfilled') setUser(userData.value);
      if (devicesData.status === 'fulfilled') setDevices(devicesData.value);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        alerts,
        devices,
        settings,
        isLoading,
        isServerOnline,
        serverStatus,
        queuedCommandCount,
        toast,
        handleLogout,
        showToast,
        hideToast,
        refreshData,
        checkServerHealth,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
export default AppContext;
