import {
  validateTemperature,
  validateHumidity,
  validateFanSpeed,
  validateEmail,
  validatePhoneNumber,
  validateDeviceName,
  validateDryingTime,
} from '../validators';

describe('validateTemperature', () => {
  it('accepts valid temperature within 50–200', () => {
    expect(validateTemperature(100)).toBe(true);
    expect(validateTemperature(50)).toBe(true);
    expect(validateTemperature(200)).toBe(true);
  });

  it('accepts string input within range', () => {
    expect(validateTemperature('75')).toBe(true);
  });

  it('rejects temperature below 50', () => {
    expect(validateTemperature(49)).toBe(false);
    expect(validateTemperature(0)).toBe(false);
  });

  it('rejects temperature above 200', () => {
    expect(validateTemperature(201)).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(validateTemperature('abc')).toBe(false);
    expect(validateTemperature(NaN)).toBe(false);
  });
});

describe('validateHumidity', () => {
  it('accepts valid humidity 0–100', () => {
    expect(validateHumidity(0)).toBe(true);
    expect(validateHumidity(50)).toBe(true);
    expect(validateHumidity(100)).toBe(true);
  });

  it('rejects humidity below 0', () => {
    expect(validateHumidity(-1)).toBe(false);
  });

  it('rejects humidity above 100', () => {
    expect(validateHumidity(101)).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(validateHumidity('wet')).toBe(false);
  });
});

describe('validateFanSpeed', () => {
  it('accepts valid fan speed 0–100', () => {
    expect(validateFanSpeed(0)).toBe(true);
    expect(validateFanSpeed(70)).toBe(true);
    expect(validateFanSpeed(100)).toBe(true);
  });

  it('rejects fan speed above 100', () => {
    expect(validateFanSpeed(101)).toBe(false);
  });

  it('rejects negative fan speed', () => {
    expect(validateFanSpeed(-5)).toBe(false);
  });
});

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('a.b+c@domain.co')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('no@domain')).toBe(false);
    expect(validateEmail('@missing.com')).toBe(false);
    expect(validateEmail('spaces in@email.com')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validatePhoneNumber', () => {
  it('accepts valid phone numbers with at least 10 digits', () => {
    expect(validatePhoneNumber('+1 (555) 123-4567')).toBe(true);
    expect(validatePhoneNumber('5551234567')).toBe(true);
  });

  it('rejects phone numbers with fewer than 10 digits', () => {
    expect(validatePhoneNumber('555-1234')).toBe(false);
    expect(validatePhoneNumber('123')).toBe(false);
  });

  it('rejects phone numbers with invalid characters', () => {
    expect(validatePhoneNumber('555abc4567')).toBe(false);
  });
});

describe('validateDeviceName', () => {
  it('accepts valid device names', () => {
    expect(validateDeviceName('Dryer A')).toBe(true);
    expect(validateDeviceName('a')).toBe(true);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(validateDeviceName('')).toBe(false);
    expect(validateDeviceName('   ')).toBe(false);
  });

  it('rejects names longer than 50 characters', () => {
    expect(validateDeviceName('x'.repeat(51))).toBe(false);
  });

  it('accepts names at exactly 50 characters', () => {
    expect(validateDeviceName('x'.repeat(50))).toBe(true);
  });
});

describe('validateDryingTime', () => {
  it('accepts valid drying times 0 < hours <= 48', () => {
    expect(validateDryingTime(1)).toBe(true);
    expect(validateDryingTime(24)).toBe(true);
    expect(validateDryingTime(48)).toBe(true);
  });

  it('rejects zero or negative drying time', () => {
    expect(validateDryingTime(0)).toBe(false);
    expect(validateDryingTime(-5)).toBe(false);
  });

  it('rejects drying time above 48 hours', () => {
    expect(validateDryingTime(49)).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(validateDryingTime('abc')).toBe(false);
  });

  it('accepts string input within range', () => {
    expect(validateDryingTime('12')).toBe(true);
  });
});
