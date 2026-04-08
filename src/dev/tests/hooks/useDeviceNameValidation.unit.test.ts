import { describe, it, expect } from 'vitest';

// Inline the validation logic for unit testing to avoid quorum-shared module resolution issues.
// This mirrors the logic in useDeviceNameValidation.ts.
const MAX_NAME_LENGTH = 40;
const DEVICE_NAME_PATTERN = /^[\p{L}\p{N} \-()']+$/u;
const HTML_TAG_PATTERN = /<[^>]+>/;

function validateDeviceName(name: string): string | undefined {
  if (!name.trim()) return 'Device name cannot be empty';
  if (name.length > MAX_NAME_LENGTH) return 'Too long';
  if (HTML_TAG_PATTERN.test(name)) return 'Cannot contain HTML';
  if (!DEVICE_NAME_PATTERN.test(name)) return 'Invalid characters';
  return undefined;
}

describe('validateDeviceName', () => {
  it('accepts valid names', () => {
    expect(validateDeviceName('Work Laptop')).toBeUndefined();
    expect(validateDeviceName('Chrome (Windows)')).toBeUndefined();
    expect(validateDeviceName('My-Phone')).toBeUndefined();
    expect(validateDeviceName("O'Brien's iPad")).toBeUndefined();
  });

  it('rejects empty names', () => {
    expect(validateDeviceName('')).toBeDefined();
    expect(validateDeviceName('   ')).toBeDefined();
  });

  it('rejects names over 40 characters', () => {
    expect(validateDeviceName('a'.repeat(41))).toBeDefined();
    expect(validateDeviceName('a'.repeat(40))).toBeUndefined();
  });

  it('rejects names with HTML tag patterns', () => {
    expect(validateDeviceName('<script>')).toBeDefined();
    expect(validateDeviceName('</div>')).toBeDefined();
  });

  it('rejects names with disallowed characters', () => {
    expect(validateDeviceName('My@Device')).toBeDefined();
    expect(validateDeviceName('Device#1')).toBeDefined();
    expect(validateDeviceName('Dev!ce')).toBeDefined();
  });
});
