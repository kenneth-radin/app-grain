// src/utils/enums.ts
// Centralized TypeScript enums replacing magic string/number constants

export enum UserRole {
  Admin = 'admin',
  Farmer = 'farmer',
}

export enum DryerMode {
  Auto = 'auto',
  Manual = 'manual',
}

export enum DryerStatus {
  Running = 'running',
  Idle = 'idle',
}

export enum DeviceStatus {
  Online = 'online',
  Offline = 'offline',
  Idle = 'idle',
  Active = 'active',
  Error = 'error',
}

export enum AlertType {
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
  Success = 'success',
  Critical = 'critical',
}

export enum SensorThreshold {
  TempWarning = 45,
  TempDanger = 55,
  HighTempRisk = 65,
  HumidityWarning = 75,
  HumidityDanger = 85,
  MoistureTarget = 14,
  MoistureWarning = 20,
  MoistureMin = 10,
  OptTempMin = 40,
  OptTempMax = 60,
  OptHumidityMax = 60,
  OptFanMin = 70,
  OptFanMax = 90,
  CriticalTempMax = 80,
  CriticalHumidityMax = 80,
}

export enum StorageKeys {
  AuthToken = 'grain_token',
  ControlSelectedDeviceId = 'control_selectedDeviceId',
  ControlMode = 'control_mode',
  ControlTemperature = 'control_temperature',
  ControlFanSpeed = 'control_fanSpeed',
  ControlFan1Status = 'control_fan1Status',
  ControlFan2Status = 'control_fan2Status',
}

export enum ApiTimeout {
  Default = 30000,
  Startup = 45000,
  HealthCheck = 10000,
  Warmup = 45000,
}
