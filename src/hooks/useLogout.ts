import { useCallback } from 'react';
import { grainApi } from '@/api';
import { useAuth } from './useAuth';
import { useDeviceContext } from '@/context/DeviceContext';
import { useAlertContext } from '@/context/AlertContext';
import { useServerStatusContext } from '@/context/ServerStatusContext';
import * as SecureStore from 'expo-secure-store';
import { StorageKeys } from '@/utils/enums';

export function useLogout() {
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
      await authLogout();
      await SecureStore.deleteItemAsync(StorageKeys.AuthToken).catch(() => {});
    }
  }, [authLogout, deviceCtx.reset, alertCtx.reset, serverCtx.reset]);
}
