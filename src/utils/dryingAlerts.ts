import { SensorThreshold } from '@/utils/enums';

// DHT22 only — drying alerts are based on temperature and humidity.
export interface DryingAlert {
  type: 'overheating' | 'high_humidity' | 'normal';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  action: string;
}

export function analyzeDryingStatus(
  temperature: number,
  humidity: number,
): DryingAlert {
  if (temperature > SensorThreshold.HighTempRisk) {
    return {
      type: 'overheating',
      severity: 'critical',
      message: `OVERHEATING DETECTED: ${Math.round(temperature)}°C exceeds safe limit`,
      action: 'Stop dryer immediately to prevent grain damage',
    };
  }

  if (temperature > SensorThreshold.TempDanger) {
    return {
      type: 'overheating',
      severity: 'warning',
      message: 'High temperature risk — grain cracking possible',
      action: 'Reduce heater temperature or increase fan speed',
    };
  }

  if (humidity > SensorThreshold.HumidityDanger) {
    return {
      type: 'high_humidity',
      severity: 'warning',
      message: `High ambient humidity (${Math.round(humidity)}%) — drying is inefficient`,
      action: 'Continue drying or increase fan speed to remove moist air',
    };
  }

  return {
    type: 'normal',
    severity: 'info',
    message: `Drying conditions normal — ${Math.round(temperature)}°C, ${Math.round(humidity)}% RH`,
    action: 'Monitor temperature and humidity until drying completes',
  };
}