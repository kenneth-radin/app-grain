/**
 * grAIn Mobile App - API Client Library
 * Backend endpoints matching the grAIn IoT Grain Dryer API
 * DHT22 is the only sensor — temperature and humidity only.
 */

import axios, { AxiosInstance } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { StorageKeys, ApiTimeout, UserRole, DryerMode, AlertType, DeviceStatus } from '@/utils/enums'

// ─── Data Models (matching backend) ───────────────────────────

export interface User {
  _id: string
  name: string
  email: string
  role: UserRole
  profileImage?: string | null
  bio?: string
  phoneNumber?: string
  location?: string
  pushToken?: string | null
}

export interface Device {
  _id: string
  deviceId: string
  name: string
  location: string
  status: DeviceStatus
  isOnline: boolean
  lastSeen: string
  runtimeState?: {
    isRunning?: boolean
    currentMode?: DryerMode
    heaterState?: 'ON' | 'OFF'
    fan1State?: 'ON' | 'OFF'
    fan2State?: 'ON' | 'OFF'
    relayState?: 'ON' | 'OFF'
    stepperState?: 'ON' | 'OFF' | 'CW' | 'CCW'
    pendingCommand?: string | null
    activeCommand?: string | null
    lastCommand?: string | null
    commandStatus?: 'idle' | 'pending' | 'polled' | 'executing' | 'executed' | 'failed' | 'timeout' | 'error'
    commandAcknowledged?: boolean
    lastHeartbeat?: string
    currentTemperature?: number
    currentHumidity?: number
  }
}

// DHT22 sensor data — temperature and humidity only.
export interface SensorData {
  _id: string
  deviceId: string
  temperature: number
  humidity: number
  status: string
  timestamp: string
}

export interface SensorDataInput {
  deviceId: string
  temperature: number
  humidity: number
  status?: string
}

export interface AlertItem {
  _id: string
  deviceId?: string
  severity: AlertType
  title: string
  message: string
  timestamp: string
  acknowledged?: boolean
}

export interface Command {
  _id: string
  deviceId: string
  command: 'START' | 'STOP' | 'FAN_CONTROL' | 'RELAY_CONTROL' | 'STEPPER_CONTROL' | 'HEATER_CONTROL' | 'start' | 'stop' | 'fan_control'
  commandStr?: string
  status: 'pending' | 'executed' | 'failed'
  fanTarget?: 'FAN1' | 'FAN2' | 'ALL'
  fanAction?: 'ON' | 'OFF'
  relayAction?: 'ON' | 'OFF'
  stepperAction?: 'START' | 'STOP' | 'CW' | 'CCW'
  heaterAction?: 'ON' | 'OFF'
  parameters: {
    mode: DryerMode
    temperature?: number
    fanSpeed?: number
  }
  createdAt: string
}

export interface AnalyticsOverview {
  temperatureTrend?: { label: string; value: number }[]
  humidityTrend?: { label: string; value: number }[]
  dryingCycles: { label: string; value: number }[]
}

export interface DryingSession {
  _id: string
  deviceId: string
  userId: string
  status: 'active' | 'completed' | 'aborted'
  grainType: string
  avgTemperature: number
  avgHumidity: number
  dataPoints: number
  startedAt: string
  completedAt?: string
  duration?: number
  efficiency?: number
  isSimulated?: boolean
  simulationTag?: string
  createdAt: string
  updatedAt: string
}

export interface NotificationItem {
  _id: string
  userId: string
  deviceId?: string
  type: 'drying_complete' | 'alert_critical' | 'alert_warning' | 'device_offline' | 'session_started' | 'session_aborted'
  title: string
  body: string
  data?: Record<string, string>
  isRead: boolean
  sentViaFCM: boolean
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    totalPages: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  errorCode?: string
  timestamp: string
}

// ─── API Client ───────────────────────────────────────────────

const TOKEN_KEY = StorageKeys.AuthToken

class GrainApiClient {
  private client: AxiosInstance
  private baseURL: string

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.EXPO_PUBLIC_API_URL || 'https://grain-web-admin.onrender.com/api'

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: { 'Content-Type': 'application/json' },
      timeout: ApiTimeout.Default,
    })

    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.getStoredToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error: any) => Promise.reject(this.handleError(error))
    )

    this.client.interceptors.response.use(
      (response) => response,
      async (error: any) => {
        if (error.response?.status === 401) {
          await this.clearToken()
          console.warn('Authentication failed — token cleared')
        }
        return Promise.reject(this.handleError(error))
      }
    )
  }

  private async getStoredToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY)
    } catch {
      return null
    }
  }

  private async setStoredToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token)
    } catch (error) {
      console.error('Failed to store token:', error)
    }
  }

  private async clearToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    } catch (error) {
      console.error('Failed to clear token:', error)
    }
  }

  private handleError(error: any): Error {
    if (!error.response) {
      const message = error.code === 'ECONNABORTED'
        ? 'Request timed out. Please check your connection.'
        : 'Unable to connect to server. Please check that the backend is running.'
      const err = new Error(message)
      ;(err as any).code = error.code || 'NETWORK_ERROR'
      ;(err as any).status = 0
      return err
    }

    const status = error.response.status || 500
    const responseData = error.response.data

    if (status === 500) {
      const err = new Error('Server is experiencing issues. Please try again in a moment.')
      ;(err as any).code = responseData?.errorCode || 'SERVER_ERROR'
      ;(err as any).status = 500
      return err
    }

    const message = responseData?.error || error.message || 'Unknown error'
    const err = new Error(message)
    ;(err as any).code = responseData?.errorCode || 'UNKNOWN_ERROR'
    ;(err as any).status = status
    return err
  }

  private getErrorStatus(error: unknown): number | undefined {
    return typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : undefined
  }

  private getErrorCode(error: unknown): string | undefined {
    return typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined
  }

  private isColdStartRetryable(error: unknown): boolean {
    const status = this.getErrorStatus(error)
    const code = this.getErrorCode(error)
    return (
      !status ||
      status === 0 ||
      status === 502 ||
      status === 503 ||
      code === 'NETWORK_ERROR' ||
      code === 'ECONNABORTED'
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async withColdStartRetry<T>(
    operation: () => Promise<T>,
    options: { retries?: number; initialDelayMs?: number } = {}
  ): Promise<T> {
    const retries = options.retries ?? 3
    const initialDelayMs = options.initialDelayMs ?? 5000

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        if (attempt >= retries || !this.isColdStartRetryable(error)) {
          throw error
        }
        await this.sleep(initialDelayMs * Math.pow(2, attempt))
      }
    }

    throw new Error('Retry failed')
  }

  private async sendCommandViaDryerEndpoint(deviceId: string, command: string): Promise<Command> {
    const normalized = command.trim().toUpperCase()

    const postDryerCommand = async (path: string, payload: Record<string, unknown>): Promise<Command> => {
      const response = await this.client.post<ApiResponse<Command>>(path, payload)
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid command response')
    }

    if (normalized.startsWith('START:')) {
      const [, rawMode, rawTemperature, rawFanSpeed] = normalized.split(':')
      const mode = rawMode === 'AUTO' || rawMode === 'MANUAL' ? rawMode : 'MANUAL'
      const temperature = Number.parseInt(rawTemperature || '45', 10)
      const fanSpeed = Number.parseInt(rawFanSpeed || '80', 10)

      return postDryerCommand(`/dryer/${deviceId}/start`, {
        mode,
        temperature: Number.isFinite(temperature) ? temperature : 45,
        fanSpeed: Number.isFinite(fanSpeed) ? fanSpeed : 80,
      })
    }

    if (normalized === 'STOP') {
      return postDryerCommand(`/dryer/${deviceId}/stop`, {})
    }

    if (normalized.startsWith('FAN:')) {
      const [, rawTarget, rawAction] = normalized.split(':')
      const fanTarget = rawTarget === 'FAN1' || rawTarget === 'FAN2' || rawTarget === 'ALL'
        ? rawTarget
        : 'FAN1'
      const fanAction = rawAction === 'OFF' ? 'OFF' : 'ON'

      return postDryerCommand(`/dryer/${deviceId}/fan`, {
        fanTarget,
        fanAction,
      })
    }

    if (normalized.startsWith('STEP:')) {
      const stepperAction = normalized.split(':')[1]
      if (
        stepperAction === 'START' ||
        stepperAction === 'STOP' ||
        stepperAction === 'CW' ||
        stepperAction === 'CCW'
      ) {
        return postDryerCommand(`/dryer/${deviceId}/stepper`, { stepperAction })
      }
    }

    if (normalized === 'R1:1' || normalized === 'R1:0') {
      return postDryerCommand(`/dryer/${deviceId}/relay`, {
        relayAction: normalized === 'R1:1' ? 'ON' : 'OFF',
      })
    }

    if (normalized === 'H1:1' || normalized === 'H1:0') {
      return postDryerCommand(`/dryer/${deviceId}/heater`, {
        heaterAction: normalized === 'H1:1' ? 'ON' : 'OFF',
      })
    }

    throw new Error(`Unsupported command: ${command}`)
  }

  // ─── Auth ─────────────────────────────────────────────────

  auth = {
    login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
      const response = await this.client.post<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/login',
        { email, password }
      )
      const payload = (response.data.data || response.data) as { user: User; accessToken: string } | undefined
      if (payload?.accessToken && payload?.user) {
        await this.setStoredToken(payload.accessToken)
        return { token: payload.accessToken, user: payload.user }
      }
      throw new Error('Invalid login response')
    },

    register: async (name: string, email: string, password: string, role: string = UserRole.Farmer): Promise<{ token: string; user: User }> => {
      const response = await this.client.post<ApiResponse<{ user: User; accessToken: string }>>(
        '/auth/register',
        { name, email, password, role }
      )
      const payload = (response.data.data || response.data) as { user: User; accessToken: string } | undefined
      if (payload?.accessToken && payload?.user) {
        await this.setStoredToken(payload.accessToken)
        return { token: payload.accessToken, user: payload.user }
      }
      throw new Error('Invalid register response')
    },

    me: async (timeoutMs?: number): Promise<User> => {
      const response = await this.client.get<ApiResponse<{ user: User }>>('/auth/me', {
        timeout: timeoutMs ?? undefined,
      })
      if (response.data.data) {
        return response.data.data.user ?? response.data.data as any
      }
      throw new Error('Failed to get current user')
    },

    logout: async (): Promise<void> => {
      await this.clearToken()
    },

    isAuthenticated: async (): Promise<boolean> => {
      try {
        const token = await this.getStoredToken()
        return !!token
      } catch {
        return false
      }
    },

    getCurrentUser: async (): Promise<User> => {
      return this.auth.me()
    },
  }

  // ─── Devices ──────────────────────────────────────────────

  devices = {
    list: async (): Promise<Device[]> => {
      const response = await this.client.get<ApiResponse<Device[]>>('/devices')
      const data = response.data.data || response.data
      if (Array.isArray(data)) {
        // Map backend 'id' field to frontend '_id'
        return data.map((d: any) => ({ ...d, _id: d._id || d.id }))
      }
      throw new Error('Invalid devices response')
    },

    getById: async (id: string): Promise<Device> => {
      const response = await this.client.get<ApiResponse<{ device: Device }>>(`/devices/${id}`)
      if (response.data.data) {
        const raw = (response.data.data as any).device ?? response.data.data as any
        // Map backend 'id' field to frontend '_id'
        return { ...raw, _id: raw._id || raw.id }
      }
      throw new Error('Invalid device response')
    },

    register: async (deviceId: string, location: string): Promise<Device> => {
      const response = await this.client.post<ApiResponse<Device>>('/devices', {
        deviceId,
        location,
      })
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid device register response')
    },
  }

  // ─── Sensors (DHT22 only) ─────────────────────────────────

  sensors = {
    getData: async (
      deviceId: string,
      options?: { page?: number; limit?: number; hours?: number }
    ): Promise<PaginatedResponse<SensorData>> => {
      const params = {
        page: options?.page || 1,
        limit: options?.limit || 50,
        hours: options?.hours || 24,
      }
      const response = await this.client.get<ApiResponse<SensorData[]> & { pagination: any }>(
        `/sensors/${deviceId}`,
        { params }
      )
      if (response.data.data) {
        return {
          data: response.data.data,
          pagination: response.data.pagination,
        }
      }
      throw new Error('Invalid sensor data response')
    },

    getAllData: async (): Promise<SensorData[]> => {
      const response = await this.client.get<ApiResponse<SensorData[]>>('/sensors/data')
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid sensor data response')
    },

    getLatestData: async (deviceId: string): Promise<SensorData | null> => {
      const result = await this.sensors.getData(deviceId, { limit: 1 })
      return result.data[0] || null
    },

    submitData: async (payload: SensorDataInput): Promise<{ accepted: boolean }> => {
      return this.withColdStartRetry(async () => {
        const response = await this.client.post<ApiResponse<{ accepted: boolean }>>(
          '/sensors/data',
          payload,
          { timeout: ApiTimeout.Warmup }
        )
        return response.data.data ?? { accepted: response.status === 202 || response.status === 201 }
      })
    },
  }

  // ─── Dryer Control ────────────────────────────────────────

  dryer = {
    sendCommand: async (deviceId: string, command: string): Promise<Command> => {
      try {
        const response = await this.client.post<ApiResponse<Command>>(
          '/commands',
          { deviceId, command }
        )
        if (response.data.data) {
          return response.data.data
        }
        throw new Error('Invalid command response')
      } catch (error) {
        if (this.getErrorStatus(error) === 404) {
          return this.sendCommandViaDryerEndpoint(deviceId, command)
        }
        throw error
      }
    },

    start: async (
      deviceId: string,
      mode: DryerMode,
      temperature?: number,
      fanSpeed?: number
    ): Promise<Command> => {
      const hardwareMode = mode === DryerMode.Auto ? 'AUTO' : 'MANUAL'
      const hardwareTemp = Math.round(temperature ?? 45)
      const hardwareFan = Math.round(fanSpeed ?? 80)
      return this.dryer.sendCommand(deviceId, `START:${hardwareMode}:${hardwareTemp}:${hardwareFan}`)
    },

    stop: async (deviceId: string): Promise<Command> => {
      return this.dryer.sendCommand(deviceId, 'STOP')
    },

    getCommands: async (deviceId: string): Promise<Command[]> => {
      const response = await this.client.get<ApiResponse<Command[]>>(
        `/commands/${deviceId}`
      )
      if (response.data.data) {
        return Array.isArray(response.data.data) ? response.data.data : []
      }
      throw new Error('Invalid commands response')
    },

    controlFan: async (
      deviceId: string,
      fanTarget: 'FAN1' | 'FAN2' | 'ALL',
      fanAction: 'ON' | 'OFF'
    ): Promise<Command> => {
      return this.dryer.sendCommand(deviceId, `FAN:${fanTarget}:${fanAction}`)
    },

    controlStepper: async (
      deviceId: string,
      stepperAction: 'START' | 'STOP' | 'CW' | 'CCW'
    ): Promise<Command> => {
      return this.dryer.sendCommand(deviceId, `STEP:${stepperAction}`)
    },

    controlRelay: async (
      deviceId: string,
      relayAction: 'ON' | 'OFF'
    ): Promise<Command> => {
      return this.dryer.sendCommand(deviceId, relayAction === 'ON' ? 'R1:1' : 'R1:0')
    },

    controlHeater: async (
      deviceId: string,
      heaterAction: 'ON' | 'OFF'
    ): Promise<Command> => {
      return this.dryer.sendCommand(deviceId, heaterAction === 'ON' ? 'H1:1' : 'H1:0')
    },
  }

  // ─── Alerts ───────────────────────────────────────────────

  alerts = {
    getAll: async (): Promise<AlertItem[]> => {
      const response = await this.client.get<ApiResponse<AlertItem[]>>('/alerts')
      const data = response.data.data || response.data
      if (Array.isArray(data)) {
        return data
      }
      throw new Error('Invalid alerts response')
    },

    clear: async (): Promise<void> => {
      await this.client.delete('/alerts')
    },

    markRead: async (id: string | number): Promise<void> => {
      await this.client.patch(`/alerts/${id}/read`)
    },
  }

  // ─── Analytics ────────────────────────────────────────────

  analytics = {
    getOverview: async (
      period: 'daily' | 'weekly' | 'monthly' = 'daily',
      deviceId?: string
    ): Promise<AnalyticsOverview> => {
      const params: any = { period }
      if (deviceId) params.deviceId = deviceId

      const response = await this.client.get<ApiResponse<AnalyticsOverview>>(
        '/analytics/overview',
        { params }
      )
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid analytics response')
    },
  }

  // ─── Profile ────────────────────────────────────────────────

  profile = {
    get: async (): Promise<User> => {
      const response = await this.client.get<ApiResponse<User>>('/users/profile')
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid profile response')
    },

    update: async (data: {
      name?: string
      bio?: string
      phoneNumber?: string
      location?: string
    }): Promise<User> => {
      const response = await this.client.patch<ApiResponse<User>>('/users/profile', data)
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid profile update response')
    },

    updateAvatar: async (base64: string): Promise<User> => {
      const response = await this.client.post<ApiResponse<User>>(
        '/users/profile/avatar',
        { image: base64 },
      )
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid avatar update response')
    },

    changePassword: async (data: {
      currentPassword: string
      newPassword: string
      confirmPassword: string
    }): Promise<any> => {
      const response = await this.client.post('/users/change-password', data)
      return response.data
    },
  }

  // ─── Drying Sessions ────────────────────────────────────────

  sessions = {
    list: async (params?: { status?: string; deviceId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<DryingSession>> => {
      const response = await this.client.get<ApiResponse<DryingSession[]> & { pagination: any }>(
        '/sessions',
        { params }
      )
      if (response.data.data) {
        return {
          data: response.data.data,
          pagination: response.data.pagination || { total: response.data.data.length, page: 1, totalPages: 1 },
        }
      }
      throw new Error('Invalid sessions response')
    },

    getById: async (id: string): Promise<DryingSession> => {
      const response = await this.client.get<ApiResponse<DryingSession>>(`/sessions/${id}`)
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid session response')
    },

    start: async (payload: { deviceId: string; grainType?: string }): Promise<DryingSession> => {
      const response = await this.client.post<ApiResponse<DryingSession>>('/sessions', payload)
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid start session response')
    },

    end: async (id: string, action: 'complete' | 'abort'): Promise<DryingSession> => {
      const response = await this.client.patch<ApiResponse<DryingSession>>(`/sessions/${id}`, { action })
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid end session response')
    },

    getActive: async (deviceId?: string): Promise<DryingSession | null> => {
      const params: any = { status: 'active' }
      if (deviceId) params.deviceId = deviceId
      const response = await this.client.get<ApiResponse<DryingSession[]> & { pagination: any }>(
        '/sessions',
        { params }
      )
      const sessions = response.data.data
      if (sessions && sessions.length > 0) {
        return sessions[0]
      }
      return null
    },
  }

  // ─── Notifications ─────────────────────────────────────────

  notifications = {
    list: async (params?: { page?: number; limit?: number; unread?: boolean }): Promise<PaginatedResponse<NotificationItem>> => {
      const queryParams: any = {}
      if (params?.page) queryParams.page = params.page
      if (params?.limit) queryParams.limit = params.limit
      if (params?.unread) queryParams.unread = 'true'

      const response = await this.client.get<ApiResponse<NotificationItem[]> & { pagination: any }>(
        '/notifications',
        { params: queryParams }
      )
      if (response.data.data) {
        return {
          data: response.data.data,
          pagination: response.data.pagination || { total: response.data.data.length, page: 1, totalPages: 1 },
        }
      }
      throw new Error('Invalid notifications response')
    },

    markRead: async (ids?: string[]): Promise<{ unreadCount: number }> => {
      const body = ids ? { ids } : { markAll: true }
      const response = await this.client.patch<ApiResponse<{ unreadCount: number }>>('/notifications', body)
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid mark read response')
    },

    registerFCMToken: async (token: string, platform: 'android' | 'ios' | 'web' = 'android'): Promise<void> => {
      await this.client.post('/notifications/fcm-token', { token, platform })
    },

    removeFCMToken: async (token: string): Promise<void> => {
      await this.client.delete('/notifications/fcm-token', { data: { token } })
    },
  }

  // ─── Push Notifications (Legacy Expo Push) ─────────────────

  push = {
    registerToken: async (pushToken: string): Promise<void> => {
      // Register with both legacy and new endpoint
      await Promise.allSettled([
        this.client.post('/push/token', { pushToken }),
        this.notifications.registerFCMToken(pushToken, 'android'),
      ])
    },
  }

  // ─── Health ───────────────────────────────────────────────

  health = {
    warmup: async (): Promise<boolean> => {
      try {
        const response = await this.client.get('/warmup', {
          timeout: ApiTimeout.Warmup,
        })
        return response.status === 200
      } catch {
        return false
      }
    },

    check: async (timeoutMs?: number): Promise<boolean> => {
      try {
        const response = await this.client.get('/health', {
          timeout: timeoutMs ?? ApiTimeout.Startup,
        })
        return response.status === 200
      } catch {
        return false
      }
    },

    ping: async (): Promise<boolean> => {
      try {
        const response = await this.client.get('/ping', {
          timeout: ApiTimeout.HealthCheck,
        })
        return response.status === 200
      } catch {
        return false
      }
    },
  }

  getBaseURL = (): string => this.baseURL
}

export const grainApi = new GrainApiClient(process.env.EXPO_PUBLIC_API_URL || 'https://grain-web-admin.onrender.com/api')

/** Returns true if the error is a network/connectivity error (not a server response like 401).
 *  Also treats HTTP 500/502/503 as server-unavailable — Render returns these during cold starts or crashes. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as any).code
    const status = (error as any).status
    return !status || status === 0 || status === 500 || status === 502 || status === 503 || code === 'NETWORK_ERROR' || code === 'ECONNABORTED' || code === 'SERVER_ERROR'
  }
  return false
}

export type { GrainApiClient }