import { useState, useEffect, useCallback } from 'react';
import { grainApi } from '@/api';

// ─── Types ────────────────────────────────────────────────

export interface SensorInput {
  deviceId: string;       // Device ID
  temperature: number;   // °C
  humidity: number;      // %
  moisture: number;      // current grain moisture %
  fanSpeed: number;      // %
  timeElapsed: number;   // minutes since drying started
  solarVoltage?: number; // V (optional)
}

export interface AIPrediction {
  predictedMoisture30min: number;
  estimatedMinutesToTarget: number;
  recommendation: string;
  recommendationType: 'optimal' | 'warning' | 'critical';
  action: 'STOP' | 'REDUCE_TEMP' | 'INCREASE_TEMP' | 'INCREASE_FAN' | 'MAINTAIN';
  efficiencyScore: number;   // 0–100
  confidence: number;        // 0–100
  isDryingComplete: boolean;
  projectedMoistureCurve: { time: number; moisture: number }[];
  targetMoisture: number;
  algorithm: string;
}

// ─── Physics-based drying model (Page's equation simplified) ────

const TARGET_MOISTURE = 14;  // % wet basis — safe storage for rice
const MIN_MOISTURE = 10;     // % — below this = over-drying risk
const OPT_TEMP_MIN = 40;     // °C
const OPT_TEMP_MAX = 60;     // °C
const OPT_HUMIDITY_MAX = 60; // %
const OPT_FAN_MIN = 70;      // %
const OPT_FAN_MAX = 90;      // %

function calculateDryingRate(temp: number, fanSpeed: number): number {
  // Base moisture loss per minute (empirical for thin-layer rice drying)
  const baseRate = 0.008;
  const tempFactor = (temp - 30) / 40;   // normalize 30–70°C
  const fanFactor = fanSpeed / 100;
  return baseRate * (1 + tempFactor * 0.6) * (0.4 + fanFactor * 0.6);
}

function predictMoisture(
  currentMoisture: number,
  minutesAhead: number,
  dryingRate: number,
): number {
  const predicted = currentMoisture - dryingRate * minutesAhead;
  return Math.max(MIN_MOISTURE, predicted);
}

function estimateTimeToTarget(
  currentMoisture: number,
  targetMoisture: number,
  dryingRate: number,
): number {
  if (currentMoisture <= targetMoisture) return 0;
  if (dryingRate <= 0) return Infinity;
  return Math.ceil((currentMoisture - targetMoisture) / dryingRate);
}

function generateRecommendation(input: SensorInput): {
  text: string;
  type: 'optimal' | 'warning' | 'critical';
  action: AIPrediction['action'];
} {
  if (input.moisture <= TARGET_MOISTURE) {
    return { text: 'Target moisture reached — drying complete! Stop dryer to prevent over-drying', type: 'optimal', action: 'STOP' };
  }
  if (input.temperature > 65) {
    return { text: 'Temperature too high — reduce heating by 5°C to prevent grain cracking', type: 'critical', action: 'REDUCE_TEMP' };
  }
  if (input.temperature < 35) {
    return { text: 'Temperature too low — increase heating for faster drying', type: 'warning', action: 'INCREASE_TEMP' };
  }
  if (input.fanSpeed < 50) {
    return { text: `Increase fan speed to ${Math.min(input.fanSpeed + 20, 85)}% for better airflow`, type: 'warning', action: 'INCREASE_FAN' };
  }
  if (input.humidity > 70) {
    return { text: 'High ambient humidity detected — increase exhaust fan speed', type: 'warning', action: 'INCREASE_FAN' };
  }
  return { text: 'Optimal drying conditions — maintain current settings', type: 'optimal', action: 'MAINTAIN' };
}

function calculateEfficiency(input: SensorInput): number {
  let score = 100;
  // Temperature penalty
  if (input.temperature < OPT_TEMP_MIN) score -= (OPT_TEMP_MIN - input.temperature) * 2;
  if (input.temperature > OPT_TEMP_MAX) score -= (input.temperature - OPT_TEMP_MAX) * 3;
  // Humidity penalty
  if (input.humidity > OPT_HUMIDITY_MAX) score -= (input.humidity - OPT_HUMIDITY_MAX) * 1.5;
  // Fan speed penalty
  if (input.fanSpeed < OPT_FAN_MIN) score -= (OPT_FAN_MIN - input.fanSpeed) * 0.5;
  if (input.fanSpeed > OPT_FAN_MAX) score -= (input.fanSpeed - OPT_FAN_MAX) * 0.3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateConfidence(input: SensorInput): number {
  // Higher confidence when conditions are stable and within optimal ranges
  let confidence = 70; // base
  if (input.temperature >= OPT_TEMP_MIN && input.temperature <= OPT_TEMP_MAX) confidence += 10;
  if (input.humidity <= OPT_HUMIDITY_MAX) confidence += 8;
  if (input.fanSpeed >= OPT_FAN_MIN && input.fanSpeed <= OPT_FAN_MAX) confidence += 7;
  if (input.timeElapsed > 30) confidence += 5; // more data = more confidence
  return Math.min(100, confidence);
}

function generateMoistureCurve(
  currentMoisture: number,
  dryingRate: number,
): { time: number; moisture: number }[] {
  return Array.from({ length: 13 }, (_, i) => ({
    time: i * 30,
    moisture: Math.max(MIN_MOISTURE, currentMoisture - dryingRate * i * 30),
  }));
}

// ─── Main prediction function ─────────────────────────────

export function runPrediction(input: SensorInput): AIPrediction {
  const dryingRate = calculateDryingRate(input.temperature, input.fanSpeed);
  const predictedMoisture30min = predictMoisture(input.moisture, 30, dryingRate);
  const estimatedMinutesToTarget = estimateTimeToTarget(input.moisture, TARGET_MOISTURE, dryingRate);
  const recommendation = generateRecommendation(input);
  const efficiencyScore = calculateEfficiency(input);
  const confidence = calculateConfidence(input);
  const isDryingComplete = input.moisture <= TARGET_MOISTURE;
  const projectedMoistureCurve = generateMoistureCurve(input.moisture, dryingRate);

  return {
    predictedMoisture30min: Math.round(predictedMoisture30min * 10) / 10,
    estimatedMinutesToTarget,
    recommendation: recommendation.text,
    recommendationType: recommendation.type,
    action: recommendation.action,
    efficiencyScore,
    confidence,
    isDryingComplete,
    projectedMoistureCurve,
    targetMoisture: TARGET_MOISTURE,
    algorithm: 'Rule-based Drying Model v1',
  };
}

// ─── Hook ─────────────────────────────────────────────────

interface UseAIPredictionOptions {
  pollInterval?: number; // ms, 0 = no polling
  autoFetch?: boolean;   // if true, fetches devices + sensor data automatically
}

export function useAIPrediction(
  sensorInput: SensorInput | null | undefined,
  options?: UseAIPredictionOptions,
) {
  const { pollInterval = 0, autoFetch = false } = options || {};
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  const compute = useCallback(async () => {
    setIsLoading(true);
    try {
      let input: SensorInput | null = sensorInput || null;

      // Auto-fetch sensor data if no input provided and autoFetch is enabled
      if (!input && autoFetch) {
        try {
          const devices = await grainApi.devices.list();
          if (devices && devices.length > 0) {
            const device = devices[0];
            const latest = await grainApi.sensors.getLatestData(device.deviceId);
            if (latest) {
              input = {
                deviceId: device.deviceId,
                temperature: latest.temperature ?? 45,
                humidity: latest.humidity ?? 50,
                moisture: latest.moisture ?? 20,
                fanSpeed: latest.fanSpeed ?? 70,
                timeElapsed: 60,
              };
            }
          }
        } catch {
          // Device/sensor fetch failed — will use demo input below
        }
      }

      // Demo fallback if still no input
      if (!input) {
        input = { deviceId: 'demo', temperature: 45, humidity: 50, moisture: 20, fanSpeed: 70, timeElapsed: 60 };
      }

      try {
        const result = await grainApi.ai.predict(input);
        setIsOfflineFallback(false);
        setPrediction({
          predictedMoisture30min: result.predictedMoisture30min,
          estimatedMinutesToTarget: result.estimatedMinutesToTarget,
          recommendation: result.recommendation,
          recommendationType: result.recommendationType,
          action: (result.action ?? 'MAINTAIN') as AIPrediction['action'],
          efficiencyScore: result.efficiencyScore,
          confidence: result.confidence,
          isDryingComplete: result.isDryingComplete,
          projectedMoistureCurve: result.projectedCurve,
          targetMoisture: result.targetMoisture,
          algorithm: result.algorithm,
        });
      } catch {
        // Server unavailable — use client-side prediction
        setIsOfflineFallback(true);
        setPrediction(runPrediction(input));
      }
    } catch {
      // Complete fallback
      setIsOfflineFallback(true);
      setPrediction(runPrediction({ deviceId: 'demo', temperature: 45, humidity: 50, moisture: 20, fanSpeed: 70, timeElapsed: 60 }));
    } finally {
      setIsLoading(false);
    }
  }, [sensorInput, autoFetch]);

  useEffect(() => {
    compute();
    if (pollInterval > 0) {
      const id = setInterval(compute, pollInterval);
      return () => clearInterval(id);
    }
  }, [compute, pollInterval]);

  return { prediction, isLoading, isOfflineFallback, refetch: compute };
}
