import { describe, it, expect } from 'vitest';

const SENDER = 'QmSender000000000000000000000000000000000';

describe('buildGlobalSenderMap / resolveGlobalSender', () => {
  it('resolves a sender to its member from the matching space (mapped to resolver shape)', async () => {
    const { buildGlobalSenderMap } = await import('../../../utils/resolveGlobalSender');
    const resolve = buildGlobalSenderMap({
      s1: [{ user_address: SENDER, display_name: 'Ada', user_icon: 'icon.png' }],
    });
    const user = resolve('s1', SENDER);
    expect(user?.address).toBe(SENDER);
    expect(user?.displayName).toBe('Ada');
    expect(user?.userIcon).toBe('icon.png');
  });

  it('returns a minimal address-only object when the sender is unknown', async () => {
    const { buildGlobalSenderMap } = await import('../../../utils/resolveGlobalSender');
    const resolve = buildGlobalSenderMap({ s1: [] });
    const user = resolve('s1', SENDER);
    expect(user?.address).toBe(SENDER);
    expect(user?.displayName).toBeUndefined();
  });

  it('returns an address-only object when the space is not in the map', async () => {
    const { buildGlobalSenderMap } = await import('../../../utils/resolveGlobalSender');
    const resolve = buildGlobalSenderMap({});
    const user = resolve('unknown-space', SENDER);
    expect(user?.address).toBe(SENDER);
  });
});
