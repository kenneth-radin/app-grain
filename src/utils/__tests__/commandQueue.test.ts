import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueCommand, getQueue, getQueueCount, flushQueue, onQueueCountChange, type QueuedCommand } from '../commandQueue';
import { grainApi } from '@/api';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock('@/api', () => ({
  grainApi: { dryer: { start: jest.fn(), stop: jest.fn(), controlFan: jest.fn() } },
}));

const mockStart = grainApi.dryer.start as jest.Mock;
const mockStop = grainApi.dryer.stop as jest.Mock;
const mockControlFan = grainApi.dryer.controlFan as jest.Mock;

const makeCmd = (o: Partial<QueuedCommand> = {}): QueuedCommand => ({
  id: 'cmd-1', deviceId: 'dev-1', type: 'start',
  payload: { mode: 'auto', temperature: 55, fanSpeed: 80 },
  queuedAt: Date.now(), ...o,
});

describe('commandQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getQueue', () => {
    it('returns empty array when nothing stored', async () => {
      expect(await getQueue()).toEqual([]);
    });
    it('returns parsed queue', async () => {
      const stored = [makeCmd()];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored));
      expect(await getQueue()).toEqual(stored);
    });
  });

  describe('getQueueCount', () => {
    it('returns 0 for empty queue', async () => {
      expect(await getQueueCount()).toBe(0);
    });
    it('returns correct count', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([makeCmd(), makeCmd({ id: 'cmd-2' })]));
      expect(await getQueueCount()).toBe(2);
    });
  });

  describe('enqueueCommand', () => {
    it('appends to existing queue and persists', async () => {
      const existing = [makeCmd()];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
      const newCmd = makeCmd({ id: 'cmd-2' });
      await enqueueCommand(newCmd);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('grain_command_queue', JSON.stringify([...existing, newCmd]));
    });
    it('notifies queue count listeners', async () => {
      const listener = jest.fn();
      const unsub = onQueueCountChange(listener);
      await enqueueCommand(makeCmd());
      expect(listener).toHaveBeenCalledWith(1);
      unsub();
    });
  });

  describe('flushQueue', () => {
    it('does nothing when queue is empty', async () => {
      await flushQueue();
      expect(mockStart).not.toHaveBeenCalled();
    });
    it('flushes start commands', async () => {
      const cmd = makeCmd({ type: 'start' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([cmd]));
      mockStart.mockResolvedValue({});
      await flushQueue();
      expect(mockStart).toHaveBeenCalledWith(cmd.deviceId, cmd.payload.mode, cmd.payload.temperature, cmd.payload.fanSpeed);
    });
    it('flushes stop commands', async () => {
      const cmd = makeCmd({ type: 'stop', payload: {} });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([cmd]));
      mockStop.mockResolvedValue({});
      await flushQueue();
      expect(mockStop).toHaveBeenCalledWith(cmd.deviceId);
    });
    it('flushes fan_control commands', async () => {
      const cmd = makeCmd({ type: 'fan_control', payload: { fan: 'fan1', action: 'on' } });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([cmd]));
      mockControlFan.mockResolvedValue({});
      await flushQueue();
      expect(mockControlFan).toHaveBeenCalledWith(cmd.deviceId, cmd.payload.fan, cmd.payload.action);
    });
    it('stops flushing on API failure and keeps remaining', async () => {
      const cmds = [makeCmd({ id: 'c1', type: 'stop', payload: {} }), makeCmd({ id: 'c2', type: 'stop', payload: {} })];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cmds));
      mockStop.mockRejectedValueOnce(new Error('offline'));
      await flushQueue();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('grain_command_queue', JSON.stringify(cmds));
    });
    it('removes queue when all flushed successfully', async () => {
      const cmd = makeCmd({ type: 'stop', payload: {} });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([cmd]));
      mockStop.mockResolvedValue({});
      await flushQueue();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('grain_command_queue');
    });
    it('notifies listeners with remaining count after flush', async () => {
      const listener = jest.fn();
      const unsub = onQueueCountChange(listener);
      const cmd = makeCmd({ type: 'stop', payload: {} });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([cmd]));
      mockStop.mockResolvedValue({});
      await flushQueue();
      expect(listener).toHaveBeenCalledWith(0);
      unsub();
    });
  });
});
