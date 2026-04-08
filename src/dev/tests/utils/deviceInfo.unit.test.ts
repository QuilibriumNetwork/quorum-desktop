import { describe, it, expect } from 'vitest';

describe('truncateAddress', () => {
  it('truncates a long address to first4...last4', async () => {
    const { truncateAddress } = await import('../../../utils/deviceInfo');
    expect(truncateAddress('QmSXkX2d1q8PASMPaMjieh6yyricTG89NY8QzEvj7273Jz')).toBe('QmSX...73Jz');
  });

  it('returns address unchanged if 8 chars or shorter', async () => {
    const { truncateAddress } = await import('../../../utils/deviceInfo');
    expect(truncateAddress('Qm123456')).toBe('Qm123456');
  });
});
