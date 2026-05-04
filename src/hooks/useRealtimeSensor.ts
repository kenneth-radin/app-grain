import { useEffect, useState, useRef } from 'react'
import { ref, onValue, type Unsubscribe } from 'firebase/database'
import { db } from '@/lib/firebase'
import { DeviceStatus } from '@/utils/enums'
import { isSensorData } from '@/utils/typeGuards'

export interface RealtimeSensorData {
  temperature: number
  humidity: number
  moisture: number
  fanSpeed: number
  energy: number
  status: string
  updatedAt: number
}

export function useRealtimeSensor(deviceId?: string) {
  const [sensorData, setSensorData] = useState<RealtimeSensorData | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [remoteCommand, setRemoteCommand] = useState<string | null>(null)
  const [commandAcknowledged, setCommandAcknowledged] = useState(false)
  const [isFallbackMode, setIsFallbackMode] = useState(!db)
  const prevStatusRef = useRef<string | null>(null)
  const lastCommandTimestampRef = useRef<number>(0)

  useEffect(() => {
    if (!deviceId || !db) {
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
    prevStatusRef.current = null
    lastCommandTimestampRef.current = 0

    const sensorRef = ref(db, `grain/devices/${deviceId}/sensors`)
    const statusRef = ref(db, `grain/devices/${deviceId}/status`)
    const commandRef = ref(db, `grain/devices/${deviceId}/lastCommand`)
    const executedRef = ref(db, `grain/commands/${deviceId}/executed`)

    const unsubs: Unsubscribe[] = []

    unsubs.push(onValue(sensorRef, (snapshot) => {
      const raw = snapshot.val()
      if (isSensorData(raw)) {
        setSensorData(raw)
        setLastUpdated(new Date())
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

    unsubs.push(onValue(statusRef, (snapshot) => {
      setIsOnline(snapshot.val() === DeviceStatus.Online)
    }))

    unsubs.push(onValue(commandRef, (snapshot) => {
      const cmd = snapshot.val()
      if (cmd && cmd.action) {
        setRemoteCommand(cmd.action)
        lastCommandTimestampRef.current = cmd.timestamp ?? Date.now()
      }
    }))

    unsubs.push(onValue(executedRef, (snapshot) => {
      const data = snapshot.val()
      if (data?.executedAt > lastCommandTimestampRef.current) {
        setCommandAcknowledged(true)
      }
    }))

    return () => {
      // Unsubscribe all 4 listeners reliably on deviceId change or unmount
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [deviceId])

  return { sensorData, isOnline, isFallbackMode, lastUpdated, remoteCommand, commandAcknowledged }
}
