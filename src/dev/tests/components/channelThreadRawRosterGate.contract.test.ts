/**
 * Source-level contract: Channel.tsx's `threadCtx.setChannelProps({ members: ... })`
 * must pass the RAW roster, never `effectiveMembers` (the public-profile-
 * backfilled map from `useVisibleSenderProfileFallback`).
 *
 * Found in fix round 1 on Phase D rows 22-24: `ThreadPanel.tsx` forwards
 * `channelProps.members` straight into `<MessageList members={...}>`, which
 * is where the membership/kicked GATE (`resolveMessageListSenderGate`, row
 * 22) reads from. Channel.tsx was passing `effectiveMembers` there — the
 * gate's input was the profile-backfill hook's OUTPUT, not the roster. This
 * happened to stay safe only because `useVisibleSenderProfileFallback`
 * spreads `...local` (the raw roster row) and so carries `isKicked` through
 * incidentally — a property of a different hook that nothing pins. A
 * reasonable-looking tidy-up of that hook's return shape (an explicit field
 * list instead of a spread) would silently open the kicked gate for threads
 * with the whole test suite green, because no BEHAVIOURAL test exercises
 * Channel.tsx (it is too large to mount — see `ChannelTypingIndicator`'s own
 * doc comment) and no test built a real `effectiveMembers`-shaped fixture
 * for this specific wiring.
 *
 * A behavioural test would have to mount Channel.tsx's full provider tree,
 * a thread, and a virtualized message list. The defect is which local
 * variable got passed at one call site, so pin that directly — cheap, and
 * it fails on the exact mistake. Channel's OWN <MessageList> (the per-space
 * view) is a source line safe from this specific class of drift because it
 * is a single unambiguous `members={members}` JSX prop, not a multi-field
 * object literal easy to fill in with the wrong nearby variable — this test
 * exists for the object-literal call site, where that's not true.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Channel.tsx — ThreadPanel receives the raw roster for the membership/kicked gate', () => {
  it('setChannelProps({ members }) is the raw roster, not effectiveMembers', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/space/Channel.tsx'),
      'utf8',
    );

    const callStart = source.indexOf('threadCtx.setChannelProps({');
    expect(callStart, 'threadCtx.setChannelProps({...}) call site not found — this test needs updating, not deleting').toBeGreaterThan(-1);
    const callEnd = source.indexOf('});', callStart);
    expect(callEnd, 'Could not find the end of the setChannelProps({...}) object literal').toBeGreaterThan(callStart);
    const block = source.slice(callStart, callEnd);

    const membersField = block.match(/^\s*members\s*(?::\s*(\w+))?\s*,\s*$/m);
    expect(
      membersField,
      'Could not find a `members` field inside setChannelProps({...}). ' +
        'This object literal feeds ThreadChannelProps, which <MessageList> reads ' +
        'its membership/kicked gate input from — this test needs updating to match ' +
        'whatever shape the field now has, not deleting.',
    ).not.toBeNull();

    // Shorthand `members,` (no colon) assigns the local `members` variable —
    // the raw roster — and is the correct, currently-used form. An explicit
    // `members: X,` must name that same variable.
    const assignedFrom = membersField![1] ?? 'members';
    expect(
      assignedFrom,
      'setChannelProps({ members: ' + assignedFrom + ' }) — ThreadPanel\'s <MessageList> ' +
        'membership/kicked gate must read the RAW roster (the `members` variable from ' +
        'useChannelData), never `effectiveMembers` or any other profile-backfilled map. ' +
        'See src/components/context/ThreadContext.tsx\'s ThreadChannelProps.members doc comment.',
    ).toBe('members');
  });
});
