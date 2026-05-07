import { useState, useEffect, useCallback } from 'react';
import { grainApi } from '@/api';
import type { Device } from '@/api';

interface UseDevicesResult {
  devices: Device[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDevices(): UseDevicesResult {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    // Only show loading spinner on first load — subsequent fetches are silent
    setIsLoading(prev => {
      if (prev) return true; // already loading (first time)
      return false;          // already have data — don't re-show skeleton
    });
    setError(null);
    try {
      const data = await grainApi.devices.list();
      setDevices(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return { devices, isLoading, error, refetch: fetchDevices };
}
