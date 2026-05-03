import { useState, useEffect, useCallback, useRef } from 'react';
import { grainApi, isNetworkError } from '@/api';
import type { SensorData } from '@/api';

export type StalenessReason = 'server_unreachable' | 'sensor_not_sending' | null;

interface UseSensorDataResult {
  sensorData: SensorData[];
  latestData: SensorData | null;
  isLoading: boolean;
  error: string | null;
  isServerUnreachable: boolean;
  stalenessReason: StalenessReason;
  refetch: () => Promise<void>;
}

export function useSensorData(deviceId: string | undefined, pollInterval: number = 30000): UseSensorDataResult {
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isServerUnreachable, setIsServerUnreachable] = useState(false);
  const [stalenessReason, setStalenessReason] = useState<StalenessReason>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSuccessfulFetchRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    if (!deviceId) return;
    try {
      const data = await grainApi.sensors.getData(deviceId, { hours: 24 });
      setSensorData(data.data);
      setLatestData(data.data[0] || null);
      setError(null);
      setIsServerUnreachable(false);
      lastSuccessfulFetchRef.current = Date.now();

      // Determine staleness reason: if server is reachable but data is old, sensor may not be sending
      if (data.data.length > 0) {
        const latestTimestamp = new Date(data.data[0].timestamp).getTime();
        const ageMs = Date.now() - latestTimestamp;
        if (ageMs > 5 * 60 * 1000) {
          setStalenessReason('sensor_not_sending');
        } else {
          setStalenessReason(null);
        }
      }
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        setIsServerUnreachable(true);
        setStalenessReason('server_unreachable');
        setError('Server unreachable — data may be outdated');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to fetch sensor data';
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, pollInterval]);

  return { sensorData, latestData, isLoading, error, isServerUnreachable, stalenessReason, refetch: fetchData };
}
