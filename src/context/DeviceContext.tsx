import React, { createContext, useContext, useState, useCallback } from 'react';
import { grainApi } from '@/api';
import type { User, Device } from '@/api';

interface DeviceContextType {
  user: User | null;
  devices: Device[];
  settings: any;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  reset: () => void;
}

const DeviceContext = createContext<DeviceContextType>({
  user: null,
  devices: [],
  settings: null,
  isLoading: false,
  refreshData: async () => {},
  reset: () => {},
});

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const reset = useCallback(() => {
    setUser(null);
    setDevices([]);
    setSettings(null);
  }, []);

  return (
    <DeviceContext.Provider value={{ user, devices, settings, isLoading, refreshData, reset }}>
      {children}
    </DeviceContext.Provider>
  );
}

export const useDeviceContext = () => useContext(DeviceContext);
export default DeviceContext;
