import { describe, it, expect, vi } from 'vitest';
import { resolveSyncDeltaSlots } from '@/services/MessageService';

// MessageService.ts imports the native SDK at module load; stub it so this
// pure-logic helper can be imported without the real WASM channel module.
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
}));

describe('resolveSyncDeltaSlots — a peer is not authoritative about OUR row', () => {
  it('NEVER lets a peer write our own override slot, however new it claims to be', () => {
    // The roster diff in quorum-shared walks every address with no special case
    // for our own, so any peer whose cached hash for us differs sends its stored
    // copy of our row back. Our per-space name is ours alone.
    const r = resolveSyncDeltaSlots({
      isSelf: true,
      existingOverrideTs: undefined,
      incomingOverrideTs: Number.MAX_SAFE_INTEGER,
      existingGlobalTs: undefined,
      incomingGlobalTs: 1,
    });
    expect(r.applyOverride).toBe(false);
  });

  it('still accepts our own GLOBAL slot from a peer', () => {
    // Only the override is ours to author. The global slot is our current global
    // identity, which a peer may legitimately know a newer version of.
    const r = resolveSyncDeltaSlots({
      isSelf: true,
      incomingOverrideTs: 5,
      incomingGlobalTs: 5,
    });
    expect(r.applyGlobal).toBe(true);
  });

  it('applies another member override when we have no timestamp (bootstrap)', () => {
    // Deliberate fail-open: this is how a member we have never heard of gets a
    // name at all. Pinned here so a future "hardening" has to argue with a test.
    const r = resolveSyncDeltaSlots({
      isSelf: false,
      existingOverrideTs: undefined,
      incomingOverrideTs: 0,
      incomingGlobalTs: 0,
    });
    expect(r.applyOverride).toBe(true);
  });

  it('rejects an older override for another member', () => {
    const r = resolveSyncDeltaSlots({
      isSelf: false,
      existingOverrideTs: 2000,
      incomingOverrideTs: 1000,
      incomingGlobalTs: 0,
    });
    expect(r.applyOverride).toBe(false);
  });

  it('rejects an older global slot for another member', () => {
    const r = resolveSyncDeltaSlots({
      isSelf: false,
      existingGlobalTs: 2000,
      incomingOverrideTs: 0,
      incomingGlobalTs: 1000,
    });
    expect(r.applyGlobal).toBe(false);
  });
});
