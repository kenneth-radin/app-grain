import { analyzeDryingStatus } from '../dryingAlerts';
import { SensorThreshold } from '../enums';

describe('analyzeDryingStatus', () => {
  const HIGH_TEMP = SensorThreshold.HighTempRisk; // 65
  const DANGER_TEMP = SensorThreshold.TempDanger; // 55
  const HUMIDITY_DANGER = SensorThreshold.HumidityDanger; // 85

  it('returns overheating critical when temperature exceeds HighTempRisk (65)', () => {
    const result = analyzeDryingStatus(70, 50);
    expect(result.type).toBe('overheating');
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('OVERHEATING DETECTED');
    expect(result.action).toContain('Stop dryer');
  });

  it('returns overheating critical at exactly HighTempRisk + 1', () => {
    const result = analyzeDryingStatus(HIGH_TEMP + 1, 50);
    expect(result.severity).toBe('critical');
  });

  it('returns overheating warning when temperature is between TempDanger and HighTempRisk', () => {
    const result = analyzeDryingStatus(60, 50);
    expect(result.type).toBe('overheating');
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('High temperature risk');
  });

  it('returns normal when temperature equals TempDanger exactly', () => {
    const result = analyzeDryingStatus(DANGER_TEMP, 50);
    expect(result.type).toBe('normal');
  });

  it('returns high_humidity warning when humidity exceeds HumidityDanger (85)', () => {
    const result = analyzeDryingStatus(45, 90);
    expect(result.type).toBe('high_humidity');
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('High ambient humidity');
  });

  it('prioritizes critical overheating over high humidity', () => {
    const result = analyzeDryingStatus(70, 95);
    expect(result.type).toBe('overheating');
    expect(result.severity).toBe('critical');
  });

  it('returns normal for safe temperature and humidity', () => {
    const result = analyzeDryingStatus(45, 60);
    expect(result.type).toBe('normal');
    expect(result.severity).toBe('info');
    expect(result.message).toContain('normal');
  });
});