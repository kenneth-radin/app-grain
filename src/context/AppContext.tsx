import React, { useCallback } from 'react';
import { grainApi } from '@/api';
import { useAuth } from '@/hooks';
import { DeviceProvider, useDeviceContext } from './DeviceContext';
import { AlertProvider, useAlertContext } from './AlertContext';
import { ToastProvider, useToastContext, type ToastState } from './ToastContext';
import { ServerStatusProvider, useServerStatusContext } from './ServerStatusContext';
import { DryingSessionProvider } from './DryingSessionContext';
export type { ServerStatus } from './ServerStatusContext';

// ─── Providers (compose at app root) ──────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <DeviceProvider>
      <AlertProvider>
        <ToastProvider>
          <ServerStatusProvider>
            <DryingSessionProvider>
              {children}
            </DryingSessionProvider>
          </ServerStatusProvider>
        </ToastProvider>
      </AlertProvider>
    </DeviceProvider>
  );
}

// ─── Convenience hooks (consume individual contexts) ──────
// Each hook only re-renders when its specific context changes.

export function useToast() {
  const { showToast, hideToast, toast } = useToastContext();
  return { showToast, hideToast, toast };
}

export function useDevicesData() {
  const { user, devices, settings, isLoading, refreshData } = useDeviceContext();
  return { user, devices, settings, isLoading, refreshData };
}

export function useAlertsData() {
  const { alerts, setAlerts } = useAlertContext();
  return { alerts, setAlerts };
}

export function useServerStatus() {
  const { isServerOnline, serverStatus, queuedCommandCount, checkServerHealth } = useServerStatusContext();
  return { isServerOnline, serverStatus, queuedCommandCount, checkServerHealth };
}

export function useHandleLogout() {
  const { logout: authLogout } = useAuth();
  const deviceCtx = useDeviceContext();
  const alertCtx = useAlertContext();
  const serverCtx = useServerStatusContext();

  return useCallback(async () => {
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
}

// ─── Backward-compatible re-exports ───────────────────────
export { useDeviceContext, useAlertContext, useToastContext, useServerStatusContext };
export { useDryingSession } from './DryingSessionContext';
