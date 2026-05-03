import type { RealtimeSensorData } from '@/hooks/useRealtimeSensor'

export function isSensorData(val: unknown): val is RealtimeSensorData {
  if (!val || typeof val !== 'object') return false
  const v = val as Record<string, unknown>
  return (
    typeof v.temperature === 'number' &&
    typeof v.humidity === 'number' &&
    typeof v.moisture === 'number'
  )
}
