import { describe, it, expect } from 'vitest';

const ADDR = 'QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX';

describe('resolveMemberName', () => {
  it('uses the explicit per-space override above everything else', async () => {
    const { resolveMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveMemberName(
      { address: ADDR, displayName: 'Ada', primaryUsername: 'alice' },
      { spaceOverrideName: 'Ada (mod)' },
    );
    expect(r.name).toBe('Ada (mod)');
    expect(r.isQnsVerified).toBe(false);
  });

  it('lets the QNS username win over the display name (Model B)', async () => {
    const { resolveMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveMemberName({
      address: ADDR,
      displayName: 'Whatever',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('alice');
    expect(r.isQnsVerified).toBe(true);
  });

  it('falls back to the display name when there is no QNS name', async () => {
    const { resolveMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveMemberName({ address: ADDR, displayName: 'Ada L.' });
    expect(r.name).toBe('Ada L.');
    expect(r.isQnsVerified).toBe(false);
  });

  it('falls back to the address when nothing else is present', async () => {
    const { resolveMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveMemberName({ address: ADDR });
    expect(r.isQnsVerified).toBe(false);
    // address-only fallback — non-empty, derived from the address
    expect(r.name.length).toBeGreaterThan(0);
    expect(ADDR).toContain(r.name.replace(/[…\.]/g, '').slice(0, 4));
  });

  it('treats empty/whitespace names as absent', async () => {
    const { resolveMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveMemberName(
      { address: ADDR, displayName: '   ', primaryUsername: 'alice' },
      { spaceOverrideName: '  ' },
    );
    expect(r.name).toBe('alice');
    expect(r.isQnsVerified).toBe(true);
  });

  it('treats a null primaryUsername as absent and uses the display name', async () => {
    const { resolveMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveMemberName({
      address: ADDR,
      displayName: 'Ada',
      primaryUsername: null,
    });
    expect(r.name).toBe('Ada');
    expect(r.isQnsVerified).toBe(false);
  });
});

describe('resolveSpaceMemberName', () => {
  it('lets a CUSTOM space name (differs from global) win over the QNS name', async () => {
    const { resolveSpaceMemberName } = await import('../../../utils/resolveMemberName');
    // Roster name differs from the global name → deliberately typed for this
    // space → it wins over the QNS name.
    const r = resolveSpaceMemberName({
      address: ADDR,
      displayName: 'Ada (mod)',
      globalDisplayName: 'Ada',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('Ada (mod)');
    expect(r.isQnsVerified).toBe(false);
  });

  it('lets the QNS name win when the roster name is just the global default', async () => {
    const { resolveSpaceMemberName } = await import('../../../utils/resolveMemberName');
    // Roster name equals the global name → not a custom space name → the QNS
    // name overrides it (Model B).
    const r = resolveSpaceMemberName({
      address: ADDR,
      displayName: 'Ada',
      globalDisplayName: 'Ada',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('alice');
    expect(r.isQnsVerified).toBe(true);
  });

  it('respects the roster name when the global name is unknown (conservative)', async () => {
    const { resolveSpaceMemberName } = await import('../../../utils/resolveMemberName');
    // Can't verify the roster name is just the global echo → never hide a
    // possibly-deliberate choice.
    const r = resolveSpaceMemberName({
      address: ADDR,
      displayName: 'Ada (mod)',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('Ada (mod)');
    expect(r.isQnsVerified).toBe(false);
  });

  it('shows the QNS name when there is no roster name at all', async () => {
    const { resolveSpaceMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveSpaceMemberName({ address: ADDR, primaryUsername: 'alice' });
    expect(r.name).toBe('alice');
    expect(r.isQnsVerified).toBe(true);
  });

  it('falls back to the roster name when there is no QNS name', async () => {
    const { resolveSpaceMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveSpaceMemberName({ address: ADDR, displayName: 'Ada' });
    expect(r.name).toBe('Ada');
    expect(r.isQnsVerified).toBe(false);
  });

  it('ignores whitespace when comparing roster vs global name', async () => {
    const { resolveSpaceMemberName } = await import('../../../utils/resolveMemberName');
    const r = resolveSpaceMemberName({
      address: ADDR,
      displayName: ' Ada ',
      globalDisplayName: 'Ada',
      primaryUsername: 'alice',
    });
    expect(r.name).toBe('alice');
    expect(r.isQnsVerified).toBe(true);
  });
});

describe('formatResolvedName', () => {
  it('appends ".q" only when verified', async () => {
    const { formatResolvedName } = await import('../../../utils/resolveMemberName');
    expect(formatResolvedName({ name: 'alice', isQnsVerified: true })).toBe('alice.q');
    expect(formatResolvedName({ name: 'Ada L.', isQnsVerified: false })).toBe('Ada L.');
  });
});
