/**
 * The ghost-row test.
 *
 * `interceptControlMessages` returning TRUE is the exact contract that gates
 * `saveMessage`: both DM receive paths do `if (intercepted) { …; return; }`
 * BEFORE any save (MessageService.ts — init path ~:4204/:4222, established path
 * the same shape). So "intercept returns true" and "this frame is never
 * persisted" are the same statement, and this file pins it.
 *
 * The bug it exists to stop coming back: the intercept tested `raw.type` only.
 * Mobile's `dm-update-profile` envelope has NO top-level `type` (the payload is
 * under `content`), so the branch was false, the intercept returned false, and
 * the frame was written into the conversation as a message.
 *
 * The false-arm matters as much: an ordinary post must still return false, or
 * this "fix" would eat real messages. Both arms are asserted below so a passing
 * true-arm can never be an artefact of the intercept saying true to everything.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '@/services/MessageService';
import type { Message } from '@quilibrium/quorum-shared';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
}));

const PARTNER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA';
const SELF = 'QmMeMeMeVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imBBBB';
const IMPOSTOR = 'QmThemThemKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imCCCC';

function makeService() {
  const saveConversation = vi.fn().mockResolvedValue(undefined);
  const getConversation = vi.fn().mockResolvedValue({
    conversation: {
      conversationId: `${PARTNER}/${PARTNER}`,
      type: 'direct',
      address: PARTNER,
      displayName: 'Unknown User',
      icon: '',
      timestamp: 0,
    },
  });
  const messageDB = { getConversation, saveConversation } as never;
  const service = new MessageService({ messageDB } as never);
  return { service, saveConversation, getConversation };
}

// The private method is the unit under test; TypeScript's `private` is
// compile-time only, so this reaches the real implementation, not a copy.
function intercept(service: MessageService, payload: unknown): boolean {
  return (
    service as unknown as {
      interceptControlMessages: (
        decryptedContent: Message,
        senderAddress: string,
        selfAddress: string,
        deliveryReceiptsEnabled: boolean,
        readReceiptsEnabled: boolean,
      ) => boolean;
    }
  ).interceptControlMessages(payload as Message, PARTNER, SELF, false, false);
}

const wrappedFrame = (fields: Record<string, unknown>) => ({
  messageId: 'dm-profile-9a1c22',
  channelId: PARTNER,
  spaceId: PARTNER,
  createdDate: 1_700_000_000_000,
  content: { type: 'dm-update-profile', senderId: PARTNER, ...fields },
});

const flatFrame = (fields: Record<string, unknown>) => ({
  type: 'dm-update-profile',
  senderId: PARTNER,
  ...fields,
});

describe('dm-update-profile is consumed, never persisted', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('consumes the WRAPPED (mobile) frame — this is the ghost row that used to be saved', () => {
    expect(intercept(ctx.service, wrappedFrame({ displayName: 'Ada Mobile' }))).toBe(true);
  });

  it('consumes the FLAT (desktop) frame', () => {
    expect(intercept(ctx.service, flatFrame({ displayName: 'Ada Desktop' }))).toBe(true);
  });

  it('applies the wrapped frame to the conversation row (the user-visible half)', async () => {
    intercept(ctx.service, wrappedFrame({ displayName: 'Ada Mobile', userIcon: 'icon-m' }));
    // handleDMProfileUpdate is fire-and-forget inside the intercept; let its
    // microtask chain drain before asserting.
    await vi.waitFor(() => expect(ctx.saveConversation).toHaveBeenCalledTimes(1));
    expect(ctx.saveConversation.mock.calls[0][0]).toMatchObject({
      displayName: 'Ada Mobile',
      icon: 'icon-m',
    });
  });

  it('consumes a SPOOFED frame without applying it — dropped, never rendered', async () => {
    // senderId does not match the authenticated envelope sender. Returning
    // false here would hand an attacker-authored payload to saveMessage.
    expect(
      intercept(ctx.service, wrappedFrame({ senderId: IMPOSTOR, displayName: 'Impostor' })),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(ctx.saveConversation).not.toHaveBeenCalled();
  });
});

describe('control arm — the intercept still lets real traffic through', () => {
  // Without these, "returns true" above proves nothing: an intercept that
  // returned true unconditionally would pass every assertion in the block above
  // and silently eat every message in the app.
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('does NOT consume an ordinary post', () => {
    expect(
      intercept(ctx.service, {
        messageId: 'abc123',
        content: { type: 'post', senderId: PARTNER, text: 'hello' },
      }),
    ).toBe(false);
  });

  it('does NOT consume a space update-profile (different message family)', () => {
    expect(
      intercept(ctx.service, {
        messageId: 'abc124',
        content: { type: 'update-profile', senderId: PARTNER, displayName: 'Ada' },
      }),
    ).toBe(false);
  });

  it('still consumes the pre-existing control types (unchanged behaviour)', () => {
    expect(intercept(ctx.service, { type: 'delivery-ack', senderId: PARTNER, messageIds: [] })).toBe(true);
    expect(intercept(ctx.service, { type: 'read-ack', senderId: PARTNER })).toBe(true);
    expect(intercept(ctx.service, { type: 'typing-start', senderId: PARTNER })).toBe(true);
    expect(intercept(ctx.service, { type: 'typing-stop', senderId: PARTNER })).toBe(true);
  });
});
