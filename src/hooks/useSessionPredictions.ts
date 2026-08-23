import { useState, useEffect, useCallback, useRef } from 'react';
import { grainApi, isNetworkError } from '@/api';
import type { Prediction } from '@/api';

interface UseSessionPredictionsResult {
  prediction: Prediction | null;
  history: Prediction[];
  hasActiveSession: boolean;
  isLoading: boolean;
  error: string | null;
  isServerUnreachable: boolean;
  refetch: () => Promise<void>;
}

/**
 * Polls the AI prediction for the device's active drying session.
 * Poll interval matches the backend's PREDICTION_MIN_INTERVAL_MS throttle,
 * so each fetch picks up a freshly stored prediction.
 */
const POLL_INTERVAL = 60000;

export function useSessionPredictions(deviceId: string | undefined): UseSessionPredictionsResult {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isServerUnreachable, setIsServerUnreachable] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!deviceId) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await grainApi.predictions.getForDevice(deviceId, { history: true, limit: 20 });
      setPrediction(data.latest);
      setHistory(data.history || []);
      setHasActiveSession(data.hasActiveSession);
      setError(null);
      setIsServerUnreachable(false);
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        setIsServerUnreachable(true);
        setError('Server unreachable — predictions may be outdated');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to fetch prediction';
        setError(message);
        // A 404/403 on predictions should not clear an active-session flag —
        // keep whatever we last had so the UI doesn't flicker.
      }
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return { prediction, history, hasActiveSession, isLoading, error, isServerUnreachable, refetch: fetchData };
}