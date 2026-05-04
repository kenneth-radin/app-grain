import { analyzeDryingStatus } from '../dryingAlerts';
import { SensorThreshold } from '../enums';

describe('analyzeDryingStatus', () => {
  const TARGET = SensorThreshold.MoistureTarget; // 14
  const MIN = SensorThreshold.MoistureMin; // 10
  const HIGH_TEMP = SensorThreshold.HighTempRisk; // 65

  it('returns over_drying critical when moisture is below MoistureMin (10)', () => {
    const result = analyzeDryingStatus(8, TARGET, 50);
    expect(result).toEqual({
      type: 'over_drying',
      severity: 'critical',
      message: 'OVER-DRYING DETECTED: Grain moisture below 10%',
      action: 'Stop dryer immediately to prevent grain cracking',
    });
  });

  it('returns over_drying critical at moisture = 9', () => {
    const result = analyzeDryingStatus(9, TARGET, 55);
    expect(result.type).toBe('over_drying');
    expect(result.severity).toBe('critical');
  });

  it('returns complete info when moisture is between MoistureMin and target', () => {
    const result = analyzeDryingStatus(12, TARGET, 50);
    expect(result).toEqual({
      type: 'complete',
      severity: 'info',
      message: 'Drying complete! Safe storage moisture achieved',
      action: 'Stop dryer and transfer grains to storage',
    });
  });

  it('returns complete info when moisture equals target exactly', () => {
    const result = analyzeDryingStatus(TARGET, TARGET, 50);
    expect(result.type).toBe('complete');
    expect(result.severity).toBe('info');
  });

  it('returns complete info when moisture equals MoistureMin exactly', () => {
    const result = analyzeDryingStatus(MIN, TARGET, 50);
    expect(result.type).toBe('complete');
  });

  it('returns over_drying warning when temperature exceeds HighTempRisk', () => {
    const result = analyzeDryingStatus(18, TARGET, 70);
    expect(result).toEqual({
      type: 'over_drying',
      severity: 'warning',
      message: 'High temperature risk — grain cracking possible',
      action: 'Reduce temperature or increase fan speed',
    });
  });

  it('returns normal when moisture is above target and temperature is safe', () => {
    const result = analyzeDryingStatus(20, TARGET, 50);
    expect(result.type).toBe('normal');
    expect(result.severity).toBe('info');
    expect(result.message).toContain('20%');
    expect(result.action).toContain('14%');
  });

  it('uses custom target moisture when provided', () => {
    const result = analyzeDryingStatus(16, 16, 50);
    expect(result.type).toBe('complete');
  });

  it('over_drying critical takes priority over high temperature', () => {
    const result = analyzeDryingStatus(8, TARGET, 70);
    expect(result.type).toBe('over_drying');
    expect(result.severity).toBe('critical');
  });

  it('complete takes priority over high temperature warning', () => {
    const result = analyzeDryingStatus(12, TARGET, 70);
    expect(result.type).toBe('complete');
  });
});
