/**
 * grAIn Mobile App - API Client Library
 * Backend endpoints matching the grAIn IoT Grain Dryer API
 */

import axios, { AxiosInstance } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { StorageKeys, ApiTimeout, UserRole, DryerMode, AlertType, DeviceStatus, DryerStatus } from '@/utils/enums'

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
}

export interface Device {
  _id: string
  deviceId: string
  name: string
  location: string
  status: DeviceStatus
  isOnline: boolean
  lastSeen: string
}

export interface SensorData {
  _id: string
  deviceId: string
  temperature: number
  humidity: number
  moisture: number
  fanSpeed: number
  energy: number
  status: string
  timestamp: string
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
  command: 'start' | 'stop' | 'fan_control'
  status: 'pending' | 'executed' | 'failed'
  parameters: {
    mode: DryerMode
    temperature?: number
    fanSpeed?: number
  }
  createdAt: string
}

export interface AnalyticsOverview {
  moistureTrend: { label: string; value: number }[]
  dryingCycles: { label: string; value: number }[]
  energyConsumption: { label: string; value: number }[]
}

export interface AIPrediction {
  predictedMoisture30min: number
  estimatedMinutesToTarget: number
  recommendation: string
  recommendationType: 'optimal' | 'warning' | 'critical'
  efficiencyScore: number
  confidence: number
  isDryingComplete: boolean
  projectedCurve: { time: number; moisture: number }[]
  targetMoisture: number
  algorithm: string
}

export interface SensorInput {
  deviceId: string
  temperature: number
  humidity: number
  moisture: number
  fanSpeed: number
  timeElapsed: number
  solarVoltage?: number
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
    console.log(`[grainApi] baseURL: ${this.baseURL}`)

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

    const responseData = error.response.data
    const message = responseData?.error || error.message || 'Unknown error'
    const err = new Error(message)
    ;(err as any).code = responseData?.errorCode || 'UNKNOWN_ERROR'
    ;(err as any).status = error.response.status || 500
    return err
  }

  // ─── Auth ─────────────────────────────────────────────────

  auth = {
    login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
      const response = await this.client.post<ApiResponse<{ token: string; user: User }>>(
        '/auth/login',
        { email, password }
      )
      const payload = (response.data.data || response.data) as { token: string; user: User } | undefined
      if (payload?.token && payload?.user) {
        await this.setStoredToken(payload.token)
        return { token: payload.token, user: payload.user }
      }
      throw new Error('Invalid login response')
    },

    register: async (name: string, email: string, password: string, role: string = UserRole.Farmer): Promise<{ token: string; user: User }> => {
      const response = await this.client.post<ApiResponse<{ token: string; user: User }>>(
        '/auth/register',
        { name, email, password, role }
      )
      const payload = (response.data.data || response.data) as { token: string; user: User } | undefined
      if (payload?.token && payload?.user) {
        await this.setStoredToken(payload.token)
        return { token: payload.token, user: payload.user }
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

  // ─── Sensors ──────────────────────────────────────────────

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
  }

  // ─── Dryer Control ────────────────────────────────────────

  dryer = {
    start: async (
      deviceId: string,
      mode: DryerMode,
      temperature?: number,
      fanSpeed?: number
    ): Promise<Command> => {
      const body: any = { mode }
      if (temperature !== undefined) body.temperature = temperature
      if (fanSpeed !== undefined) body.fanSpeed = fanSpeed

      const response = await this.client.post<ApiResponse<Command>>(
        `/dryer/${deviceId}/start`,
        body
      )
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid start response')
    },

    stop: async (deviceId: string): Promise<Command> => {
      const response = await this.client.post<ApiResponse<Command>>(
        `/dryer/${deviceId}/stop`
      )
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid stop response')
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
      fan: 'FAN1' | 'FAN2' | 'ALL',
      action: 'ON' | 'OFF'
    ): Promise<Command> => {
      const response = await this.client.post<ApiResponse<Command>>(
        `/dryer/${deviceId}/fan`,
        { fan, action }
      )
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid fan control response')
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

  // ─── AI ────────────────────────────────────────────────────

  ai = {
    predict: async (params: SensorInput): Promise<AIPrediction> => {
      const response = await this.client.post<ApiResponse<AIPrediction>>(
        '/ai/predict',
        params,
      )
      if (response.data.data) {
        return response.data.data
      }
      throw new Error('Invalid AI prediction response')
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

  // ─── Health ───────────────────────────────────────────────

  health = {
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
  }

  getBaseURL = (): string => this.baseURL
}

export const grainApi = new GrainApiClient(process.env.EXPO_PUBLIC_API_URL || 'https://grain-web-admin.onrender.com/api')

/** Returns true if the error is a network/connectivity error (not a server response like 401). */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as any).code
    const status = (error as any).status
    return !status || status === 0 || code === 'NETWORK_ERROR' || code === 'ECONNABORTED'
  }
  return false
}

export type { GrainApiClient }
