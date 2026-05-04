import React, { createContext, useContext, useCallback } from 'react';
import { grainApi } from '@/api';
import type { User, Device, AlertItem } from '@/api';
import { useAuth } from '@/hooks';
import { DeviceProvider, useDeviceContext } from './DeviceContext';
import { AlertProvider, useAlertContext } from './AlertContext';
import { ToastProvider, useToastContext, type ToastState } from './ToastContext';
import { ServerStatusProvider, useServerStatusContext } from './ServerStatusContext';
export type { ServerStatus } from './ServerStatusContext';

interface AppContextType {
  user: User | null;
  alerts: AlertItem[];
  devices: Device[];
  settings: any;
  isLoading: boolean;
  isServerOnline: boolean;
  serverStatus: import('./ServerStatusContext').ServerStatus;
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

function AppContextInner({ children }: { children: React.ReactNode }) {
  const { logout: authLogout } = useAuth();
  const deviceCtx = useDeviceContext();
  const alertCtx = useAlertContext();
  const toastCtx = useToastContext();
  const serverCtx = useServerStatusContext();

  const handleLogout = useCallback(async () => {
    try {
      await grainApi.auth.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      deviceCtx.reset();
      alertCtx.reset();
      serverCtx.reset();
      authLogout();
    }
  }, [authLogout, deviceCtx.reset, alertCtx.reset, serverCtx.reset]);

  return (
    <AppContext.Provider
      value={{
        user: deviceCtx.user,
        alerts: alertCtx.alerts,
        devices: deviceCtx.devices,
        settings: deviceCtx.settings,
        isLoading: deviceCtx.isLoading,
        isServerOnline: serverCtx.isServerOnline,
        serverStatus: serverCtx.serverStatus,
        queuedCommandCount: serverCtx.queuedCommandCount,
        toast: toastCtx.toast,
        handleLogout,
        showToast: toastCtx.showToast,
        hideToast: toastCtx.hideToast,
        refreshData: deviceCtx.refreshData,
        checkServerHealth: serverCtx.checkServerHealth,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <DeviceProvider>
      <AlertProvider>
        <ToastProvider>
          <ServerStatusProvider>
            <AppContextInner>{children}</AppContextInner>
          </ServerStatusProvider>
        </ToastProvider>
      </AlertProvider>
    </DeviceProvider>
  );
}

export const useAppContext = () => useContext(AppContext);
export default AppContext;
