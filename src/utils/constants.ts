import Constants from 'expo-constants'

export const APP_NAME = 'grAIn';
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export const COLORS = {
  primary: '#22C55E',
  primaryLight: 'rgba(34,197,94,0.15)',
  primaryDark: '#16A34A',
  background: '#F0FDF4',
  card: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  orange: '#F97316',
  danger: '#EF4444',
  warning: '#F97316',
  red: '#EF4444',
  gold: '#FFD700',
  dark: '#000000',
  light: '#F5F5F5',
  white: '#FFFFFF',
  gray: {
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    700: '#374151',
  },
  success: '#22C55E',
  error: '#EF4444',
  info: '#3B82F6',
};

export const GRADIENTS = {
  login: ['#E8F5E9', '#F0FFF4', '#FFFFFF'] as const,
  dashboard: ['#F0FFF4', '#E8F5E9', '#DCFCE7'] as const,
  control: ['#FFF9F0', '#FFF3E0', '#F0FFF4'] as const,
  analytics: ['#F0FFF4', '#E8F5E9', '#DCFCE7'] as const,
  alerts: ['#FFF5F5', '#FEF2F2', '#F0FFF4'] as const,
  settings: ['#F0FFF4', '#E8F5E9', '#DCFCE7'] as const,
};

export const GLASS = {
  intensity: 80,
  tint: 'light' as const,
  backgroundColor: 'rgba(255,255,255,0.25)',
  borderColor: 'rgba(255,255,255,0.4)',
  borderRadius: 16,
  shadowOpacity: 0.1,
  shadowRadius: 20,
  overflow: 'hidden' as const,
};

export const IOS_TYPOGRAPHY = {
  largeTitle: { fontSize: 28, fontWeight: '700' as const },
  title1: { fontSize: 22, fontWeight: '700' as const },
  title2: { fontSize: 20, fontWeight: '700' as const },
  title3: { fontSize: 18, fontWeight: '600' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 16, fontWeight: '400' as const },
  subhead: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  caption1: { fontSize: 12, fontWeight: '400' as const },
  caption2: { fontSize: 11, fontWeight: '400' as const },
};

// Re-export enums for backward compatibility
export { DryerMode, DryerStatus, DeviceStatus, AlertType, SensorThreshold, StorageKeys, ApiTimeout, UserRole } from './enums';

export const TEMPERATURE_RANGE = {
  MIN: 50,
  MAX: 200,
  DEFAULT: 140,
};

export const HUMIDITY_RANGE = {
  MIN: 0,
  MAX: 100,
  OPTIMAL_MIN: 30,
  OPTIMAL_MAX: 60,
};

export const FAN_SPEED_RANGE = {
  MIN: 0,
  MAX: 100,
  DEFAULT: 50,
};

export const TIME_INTERVALS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', icon: 'DashboardIcon' },
  { id: 'control', label: 'Control', icon: 'ControlIcon' },
  { id: 'analytics', label: 'Analytics', icon: 'AnalyticsIcon' },
  { id: 'alerts', label: 'Alerts', icon: 'AlertsIcon' },
  { id: 'settings', label: 'Settings', icon: 'SettingsIcon' },
];

export const DRYING = {
  STALE_THRESHOLD_MS: 5 * 60 * 1000,
  VERY_STALE_THRESHOLD_MS: 15 * 60 * 1000,
  AI_POLL_INTERVAL_MS: 60000,
  SENSOR_POLL_INTERVAL_MS: 30000,
  MAX_COMMAND_HISTORY: 10,
  COMMAND_ACK_TIMEOUT_MS: 30000,
  COMMAND_ACK_DISPLAY_MS: 5000,
  COMMAND_TIMEOUT_DISPLAY_MS: 5000,
  SYNC_WINDOW_MS: 15000,
  TEMP_MIN: 30,
  TEMP_MAX: 70,
  TEMP_STEP: 0.5,
  FAN_MIN: 0,
  FAN_MAX: 100,
  FAN_STEP: 5,
  PRESET_HIGH_TEMP: 90,
  PRESET_HIGH_FAN: 100,
  PRESET_MEDIUM_TEMP: 65,
  PRESET_MEDIUM_FAN: 60,
} as const;

export const DEFAULT_SETTINGS = {
  temperatureUnit: 'C',
  notifications: true,
  darkMode: false,
  autoStart: false,
  maintenanceReminder: true,
};

// SENSOR_THRESHOLDS moved to SensorThreshold enum in enums.ts
// Use SensorThreshold.TempWarning, SensorThreshold.HumidityDanger, etc.
