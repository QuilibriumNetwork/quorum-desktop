import { describe, it, expect } from 'vitest';
import { buildGlobalSenderMap } from '@/utils/resolveGlobalSender';

const SPACE = 'QmSpace0000000000000000000000000000000000';
const ADDR = 'QmMember00000000000000000000000000000000';

describe('buildGlobalSenderMap — the global identity slot', () => {
  it('falls back to the global slot when there is no per-space override', () => {
    // The post-follow-global normal state: override empty, identity in the
    // global slot. Every other render path handles this; this one did not.
    const resolve = buildGlobalSenderMap({
      [SPACE]: [
        {
          user_address: ADDR,
          display_name: '',
          user_icon: '',
          global_display_name: 'Ada',
          global_user_icon: 'data:image/png;base64,AAA',
        },
      ] as never,
    });
    const sender = resolve(SPACE, ADDR);
    expect(sender.displayName).toBe('Ada');
    expect(sender.userIcon).toBe('data:image/png;base64,AAA');
    expect(sender.globalDisplayName).toBe('Ada');
  });

  it('a deliberate per-space override still outranks the global slot', () => {
    const resolve = buildGlobalSenderMap({
      [SPACE]: [
        {
          user_address: ADDR,
          display_name: 'Ada in this space',
          global_display_name: 'Ada',
        },
      ] as never,
    });
    const sender = resolve(SPACE, ADDR);
    expect(sender.displayName).toBe('Ada in this space');
    expect(sender.globalDisplayName).toBe('Ada');
  });

  it('unknown sender still returns an address-only record', () => {
    const resolve = buildGlobalSenderMap({});
    expect(resolve(SPACE, ADDR)).toEqual({ address: ADDR });
  });
});
