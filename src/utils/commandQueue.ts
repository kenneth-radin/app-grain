import AsyncStorage from '@react-native-async-storage/async-storage'
import { grainApi } from '@/api'

export interface QueuedCommand {
  id: string
  deviceId: string
  type: 'start' | 'stop' | 'fan_control'
  payload: Record<string, unknown>
  queuedAt: number
}

// --- Event-driven queue count (replaces 5s polling) ---
type QueueCountListener = (count: number) => void;
const listeners = new Set<QueueCountListener>();

function notifyQueueCountChange(count: number): void {
  listeners.forEach((l) => l(count));
}

export function onQueueCountChange(listener: QueueCountListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// --- Queue operations ---

export async function enqueueCommand(cmd: QueuedCommand): Promise<void> {
  const existing = await getQueue()
  const newQueue = [...existing, cmd]
  await AsyncStorage.setItem(
    'grain_command_queue',
    JSON.stringify(newQueue)
  )
  notifyQueueCountChange(newQueue.length)
}

export async function getQueue(): Promise<QueuedCommand[]> {
  const raw = await AsyncStorage.getItem('grain_command_queue')
  return raw ? JSON.parse(raw) : []
}

export async function getQueueCount(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}

export async function flushQueue(): Promise<void> {
  const queue = await getQueue()
  if (!queue.length) return
  let sentCount = 0
  for (const cmd of queue) {
    try {
      if (cmd.type === 'start') await grainApi.dryer.start(cmd.deviceId, cmd.payload.mode as any, cmd.payload.temperature as number | undefined, cmd.payload.fanSpeed as number | undefined)
      if (cmd.type === 'stop') await grainApi.dryer.stop(cmd.deviceId)
      if (cmd.type === 'fan_control') await grainApi.dryer.controlFan(cmd.deviceId, cmd.payload.fan as any, cmd.payload.action as any)
      sentCount++
    } catch {
      break // stop flushing if still offline
    }
  }
  const remaining = queue.slice(sentCount)
  if (remaining.length === 0) {
    await AsyncStorage.removeItem('grain_command_queue')
  } else {
    await AsyncStorage.setItem('grain_command_queue', JSON.stringify(remaining))
  }
  notifyQueueCountChange(remaining.length)
}
