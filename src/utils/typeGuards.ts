import type { RealtimeSensorData } from '@/hooks/useRealtimeSensor'

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val)
}

export function isSensorData(val: unknown): val is RealtimeSensorData {
  if (!val || typeof val !== 'object') return false
  const v = val as Record<string, unknown>
  return (
    isFiniteNumber(v.temperature) &&
    isFiniteNumber(v.humidity) &&
    isFiniteNumber(v.moisture) &&
    isFiniteNumber(v.fanSpeed) &&
    isFiniteNumber(v.energy) &&
    typeof v.status === 'string'
  )
}
