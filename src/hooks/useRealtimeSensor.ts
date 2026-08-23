import { useEffect, useState, useRef } from 'react'
import { ref, onValue, type Unsubscribe } from 'firebase/database'
import { db } from '@/lib/firebase'
import { DeviceStatus } from '@/utils/enums'
import { isSensorData } from '@/utils/typeGuards'

// DHT22 only — temperature and humidity are the live sensor values.
export interface RealtimeSensorData {
  temperature: number
  humidity: number
  status: string
  updatedAt: number
}

export interface RealtimeRuntimeState {
  isRunning?: boolean
  currentMode?: 'AUTO' | 'MANUAL'
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
  lastHeartbeat?: number
}

function toTimestampMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value < 1_000_000_000_000 ? value * 1000 : value
}

function cleanupListeners(refs: React.MutableRefObject<Unsubscribe[]>) {
  for (const unsub of refs.current) {
    unsub()
  }
  refs.current = []
}

export function useRealtimeSensor(deviceId?: string) {
  const [sensorData, setSensorData] = useState<RealtimeSensorData | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [remoteCommand, setRemoteCommand] = useState<string | null>(null)
  const [commandAcknowledged, setCommandAcknowledged] = useState(false)
  const [isFallbackMode, setIsFallbackMode] = useState(!db)
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null)
  const [runtimeState, setRuntimeState] = useState<RealtimeRuntimeState | null>(null)
  const prevStatusRef = useRef<string | null>(null)
  const lastCommandTimestampRef = useRef<number>(0)
  const unsubsRef = useRef<Unsubscribe[]>([])

  useEffect(() => {
    setIsOnline(deviceStatus === DeviceStatus.Online)
  }, [deviceStatus])

  useEffect(() => {
    // Clean up any previous listeners before setting up new ones
    cleanupListeners(unsubsRef)

    if (!deviceId || !db) {
      setSensorData(null)
      setIsOnline(false)
      setLastUpdated(null)
      setRemoteCommand(null)
      setCommandAcknowledged(false)
      setDeviceStatus(null)
      setRuntimeState(null)
      setIsFallbackMode(true)
      return
    }

    // Reset state when deviceId changes to avoid stale data from previous device
    setSensorData(null)
    setIsOnline(false)
    setLastUpdated(null)
    setRemoteCommand(null)
    setCommandAcknowledged(false)
    setIsFallbackMode(false)
    setDeviceStatus(null)
    setRuntimeState(null)
    prevStatusRef.current = null
    lastCommandTimestampRef.current = 0

    const sensorRef = ref(db, `grain/devices/${deviceId}/sensors`)
    const statusRef = ref(db, `grain/devices/${deviceId}/status`)
    const runtimeRef = ref(db, `grain/devices/${deviceId}/runtimeState`)
    const commandRef = ref(db, `grain/devices/${deviceId}/lastCommand`)
    const executedRef = ref(db, `grain/commands/${deviceId}/executed`)

    unsubsRef.current.push(onValue(sensorRef, (snapshot) => {
      const raw = snapshot.val()
      if (isSensorData(raw)) {
        const updatedAt = toTimestampMs(raw.updatedAt) ?? Date.now()
        setSensorData(raw)
        setLastUpdated(new Date(updatedAt))
        // Detect remote status changes for toast notifications
        const newStatus = raw.status
        if (prevStatusRef.current && prevStatusRef.current !== newStatus) {
          if (prevStatusRef.current === 'idle' && newStatus === 'running') {
            setRemoteCommand('started')
          } else if (prevStatusRef.current === 'running' && newStatus === 'idle') {
            setRemoteCommand('stopped')
          }
        }
        prevStatusRef.current = newStatus
      } else if (raw) {
        console.warn('[Firebase] Invalid sensor data shape:', raw)
      }
    }))

    unsubsRef.current.push(onValue(statusRef, (snapshot) => {
      setDeviceStatus(snapshot.val())
    }))

    unsubsRef.current.push(onValue(runtimeRef, (snapshot) => {
      setRuntimeState(snapshot.val())
    }))

    unsubsRef.current.push(onValue(commandRef, (snapshot) => {
      const cmd = snapshot.val()
      if (cmd && cmd.action) {
        setRemoteCommand(cmd.action)
        lastCommandTimestampRef.current = cmd.timestamp ?? Date.now()
      }
    }))

    unsubsRef.current.push(onValue(executedRef, (snapshot) => {
      const data = snapshot.val()
      if (data?.executedAt > lastCommandTimestampRef.current) {
        setCommandAcknowledged(true)
      }
    }))

    return () => {
      cleanupListeners(unsubsRef)
    }
  }, [deviceId])

  return {
    sensorData,
    isOnline,
    isFallbackMode,
    lastUpdated,
    remoteCommand,
    commandAcknowledged: commandAcknowledged || runtimeState?.commandAcknowledged === true,
    runtimeState,
  }
}
