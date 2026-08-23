/**
 * What a viewer actually sees in a channel: dedup, thread-reply hiding, and
 * the personal block filter.
 *
 * All three were untested until this file (audited 2026-08-23), and the block
 * filter is the one that most needed it. Blocking is viewer-side only —
 * nothing goes on the wire, no permission is checked, no peer is told — so no
 * live relay arm can ever observe it, however many the gate grows. This
 * function and `blockUtils` in quorum-shared are the entire feature.
 *
 * The failure mode is quiet in the worst way. If the filter stops applying,
 * someone you deliberately chose not to see reappears in your stream; the only
 * person who could notice is the one who asked not to look. If it over-applies,
 * messages vanish with no error and no explanation.
 */
import { describe, it, expect } from 'vitest';
import type { Message } from '@quilibrium/quorum-shared';
import { selectVisibleMessages } from '../../../hooks/business/channels/useChannelMessages';

const BLOCKED = 'QmBlockedSenderAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const FRIEND = 'QmFriendlySenderBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

/** Only the fields this function reads; the rest of Message is irrelevant here. */
const msg = (
  messageId: string,
  senderId?: string,
  extra: { isThreadReply?: boolean } = {}
): Message =>
  ({
    messageId,
    ...extra,
    ...(senderId === undefined ? {} : { content: { senderId } }),
  }) as unknown as Message;

const visible = (
  messages: Message[],
  opts: { threadsEnabled?: boolean; blocked?: string[] } = {}
) =>
  selectVisibleMessages(messages, {
    threadsEnabled: opts.threadsEnabled ?? false,
    blockedSet: new Set(opts.blocked ?? []),
  }).map((m) => m.messageId);

describe('selectVisibleMessages: personal block', () => {
  it('hides a blocked sender and keeps everyone else', () => {
    const messages = [msg('m1', FRIEND), msg('m2', BLOCKED), msg('m3', FRIEND)];
    expect(visible(messages, { blocked: [BLOCKED] })).toEqual(['m1', 'm3']);
  });

  it('shows the same messages when nobody is blocked', () => {
    const messages = [msg('m1', FRIEND), msg('m2', BLOCKED)];
    expect(visible(messages)).toEqual(['m1', 'm2']);
  });

  // Unblocking must restore PAST messages, not just future ones. The feature is
  // a render filter for exactly this reason, and a regression to a
  // delete-on-block implementation would pass every other test here.
  it('restores past messages once the sender is no longer blocked', () => {
    const messages = [msg('m1', FRIEND), msg('m2', BLOCKED)];
    expect(visible(messages, { blocked: [BLOCKED] })).toEqual(['m1']);
    expect(visible(messages, { blocked: [] })).toEqual(['m1', 'm2']);
  });

  // A raw or partial message that bypassed getMessages() has no content at
  // all. It must stay visible rather than throw or be silently swallowed.
  it('keeps a message with no content rather than throwing', () => {
    expect(visible([msg('m1', undefined), msg('m2', FRIEND)], { blocked: [BLOCKED] })).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('matches the sender exactly, never on a prefix', () => {
    expect(visible([msg('m1', BLOCKED)], { blocked: [BLOCKED.slice(0, 20)] })).toEqual(['m1']);
  });
});

describe('selectVisibleMessages: dedup and thread replies', () => {
  it('keeps only the first message with a given id', () => {
    expect(visible([msg('m1', FRIEND), msg('m1', FRIEND), msg('m2', FRIEND)])).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('hides thread replies when the thread panel owns them', () => {
    const messages = [msg('m1', FRIEND), msg('m2', FRIEND, { isThreadReply: true })];
    expect(visible(messages, { threadsEnabled: true })).toEqual(['m1']);
  });

  it('keeps thread replies inline when threads are off', () => {
    const messages = [msg('m1', FRIEND), msg('m2', FRIEND, { isThreadReply: true })];
    expect(visible(messages, { threadsEnabled: false })).toEqual(['m1', 'm2']);
  });

  // The ordering guarantee: `seen` is recorded only for survivors, so a
  // filtered-out copy must not consume the slot its visible twin needs. If
  // dedup marked ids before the other filters ran, the blocked copy here would
  // claim 'm1' and the visible one would then be dropped as a duplicate —
  // losing a message from someone who was never blocked.
  it('does not let a filtered-out copy suppress its visible twin', () => {
    const messages = [msg('m1', BLOCKED), msg('m1', FRIEND)];
    expect(visible(messages, { blocked: [BLOCKED] })).toEqual(['m1']);
    expect(selectVisibleMessages(messages, {
      threadsEnabled: false,
      blockedSet: new Set([BLOCKED]),
    })[0].content?.senderId).toBe(FRIEND);
  });

  it('returns an empty list for an empty input', () => {
    expect(visible([])).toEqual([]);
  });
});
