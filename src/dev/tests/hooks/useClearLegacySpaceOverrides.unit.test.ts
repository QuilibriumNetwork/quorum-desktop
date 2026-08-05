import { describe, it, expect, vi } from 'vitest';
import { planLegacyOverrideClear } from '@/hooks/business/user/useClearLegacySpaceOverrides';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
  usePasskeysContext: () => ({}),
}));

const SELF = 'QmSelf00000000000000000000000000000000';
const OTHER = 'QmOther0000000000000000000000000000000';

describe('planLegacyOverrideClear', () => {
  it('clears a non-empty override on our own row', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: SELF, display_name: 'Old Name' },
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0].spaceId).toBe('A');
    expect(plan[0].previousName).toBe('Old Name');
  });

  it('never touches another member’s row', () => {
    // Our own devices are the only thing this migration may rewrite. Clearing
    // someone else's override would delete a name they deliberately chose.
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: OTHER, display_name: 'Their Name' },
    ]);
    expect(plan).toHaveLength(0);
  });

  it('ignores rows that are already clear', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: SELF, display_name: '' },
      { spaceId: 'B', user_address: SELF },
    ]);
    expect(plan).toHaveLength(0);
  });

  it('also reports a stale override avatar', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: SELF, user_icon: 'data:image/png;base64,AAA' },
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0].previousIcon).toBe('data:image/png;base64,AAA');
  });

  it('records the previous values so an irreversible clear leaves evidence', () => {
    const plan = planLegacyOverrideClear(SELF, [
      {
        spaceId: 'A',
        user_address: SELF,
        display_name: 'Old Name',
        user_icon: 'data:image/png;base64,AAA',
      },
    ]);
    expect(plan[0]).toEqual({
      spaceId: 'A',
      previousName: 'Old Name',
      previousIcon: 'data:image/png;base64,AAA',
    });
  });

  it('plans one entry per affected space', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: SELF, display_name: 'One' },
      { spaceId: 'B', user_address: SELF, display_name: 'Two' },
      { spaceId: 'C', user_address: SELF },
      { spaceId: 'D', user_address: OTHER, display_name: 'Not mine' },
    ]);
    expect(plan.map((p) => p.spaceId)).toEqual(['A', 'B']);
  });
});
