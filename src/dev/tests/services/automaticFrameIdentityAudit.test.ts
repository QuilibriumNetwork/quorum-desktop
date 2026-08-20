/**
 * THE INVARIANT: an automatic frame reveals nothing. Ever.
 *
 * The DM privacy rule only holds because your client's *automatic* replies say
 * nothing about you. A delivery receipt, a read ack, a typing signal — your
 * client sends all of these on its own, with no user action behind them. If any
 * of them carried your name or avatar, then MERELY BEING MESSAGED would unmask
 * you, and the reveal ledger, the sweep filter and the send gate would all be
 * decoration.
 *
 * This held BY ACCIDENT before this file existed. Nothing tested it, nothing
 * documented it, and adding `displayName` to an ack would have looked like a
 * harmless nicety in review. This test is what makes that a red build.
 *
 * TWO VECTORS, both covered, because they fail independently:
 *
 *   1. THE PAYLOAD — an identity field inside the control message itself.
 *   2. THE ENVELOPE — `encryptAndSendDm`'s optional `senderDisplayName` /
 *      `senderUserIcon` arguments. These do NOT appear in the payload at all;
 *      the crypto layer attaches them to the envelope's `user_profile` when the
 *      frame is init-carrying. A reviewer scanning only for identity-shaped
 *      object keys would never see this one.
 *
 * Plus a source-level sweep as the catch-all for control frames not enumerated
 * here — it is a grep-shaped heuristic, not a type-aware analysis, and it
 * exists to make the CLASS loud rather than to replace review.
 *
 * NOT IN SCOPE ON DESKTOP: ICE candidates, hangup, call events, renegotiation
 * answers. Desktop has no calling feature (MEASURED 2026-08-20: no
 * `RTCPeerConnection` reference anywhere in `src/`). Add them here the same day
 * calling lands, not after.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    DoubleRatchetInboxEncrypt: vi.fn().mockReturnValue([]),
    DoubleRatchetInboxEncryptForceSenderInit: vi.fn().mockReturnValue([]),
  },
}));

import { ActionQueueHandlers, type HandlerDependencies } from '@/services/ActionQueueHandlers';

const SELF = 'QmMeMeMeVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imBBBB';
const PARTNER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA';

/**
 * Every spelling of "who I am" that could ride an automatic frame. Both cases
 * are listed because the wire and the app layer disagree: the app uses
 * camelCase (`displayName`), the crypto boundary uses snake_case
 * (`display_name`, `user_icon`), and a leak in either spelling is a leak.
 */
const IDENTITY_KEYS = [
  'displayName',
  'display_name',
  'userIcon',
  'user_icon',
  'profileImage',
  'profile_image',
  'bio',
  'primaryUsername',
  'primary_username',
  'avatar',
  'pfpUrl',
];

function assertNoIdentity(payload: unknown, what: string): void {
  const keys = Object.keys((payload ?? {}) as Record<string, unknown>);
  const offenders = keys.filter((k) => IDENTITY_KEYS.includes(k));
  expect(offenders, `${what} carries identity field(s): ${offenders.join(', ')}`).toEqual([]);
}

function makeHandlers() {
  const encryptAndSendDm = vi.fn().mockResolvedValue(undefined);
  const deps = {
    messageDB: {
      getEncryptionStates: vi.fn().mockResolvedValue([]),
      saveEncryptionState: vi.fn().mockResolvedValue(undefined),
    },
    messageService: { encryptAndSendDm },
    queryClient: new QueryClient(),
    getUserKeyset: vi.fn().mockReturnValue({
      deviceKeyset: { inbox_keyset: { inbox_address: 'inbox-self' } },
      userKeyset: { user_key: { public_key: new Uint8Array(57), private_key: new Uint8Array(57) } },
    }),
  } as unknown as HandlerDependencies;
  return { handlers: new ActionQueueHandlers(deps), encryptAndSendDm };
}

describe('vector 1 — the automatic frame PAYLOAD carries no identity', () => {
  let ctx: ReturnType<typeof makeHandlers>;
  beforeEach(() => {
    ctx = makeHandlers();
  });

  it('delivery-ack', async () => {
    await ctx.handlers.getHandler('send-delivery-ack')!.execute({
      address: PARTNER,
      messageIds: ['m1', 'm2'],
      selfUserAddress: SELF,
    } as never);
    expect(ctx.encryptAndSendDm).toHaveBeenCalledTimes(1);
    const payload = ctx.encryptAndSendDm.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'delivery-ack' });
    assertNoIdentity(payload, 'delivery-ack');
  });

  it('read-ack', async () => {
    await ctx.handlers.getHandler('send-read-ack')!.execute({
      address: PARTNER,
      upToMessageId: 'm9',
      upToTimestamp: 1_700_000_000_000,
      messageIds: ['m9'],
      selfUserAddress: SELF,
    } as never);
    expect(ctx.encryptAndSendDm).toHaveBeenCalledTimes(1);
    const payload = ctx.encryptAndSendDm.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'read-ack' });
    assertNoIdentity(payload, 'read-ack');
  });
});

describe('vector 2 — the ENVELOPE carries no identity either', () => {
  // `encryptAndSendDm(address, payload, self, keyset, senderDisplayName?,
  // senderUserIcon?)`. Arguments 5 and 6 are the ones the crypto layer turns
  // into the envelope's `user_profile` on an init-carrying frame. An automatic
  // frame must pass NEITHER — and passing them is invisible to any check that
  // only inspects the payload object.
  let ctx: ReturnType<typeof makeHandlers>;
  beforeEach(() => {
    ctx = makeHandlers();
  });

  const assertNoIdentityArgs = (call: unknown[], what: string) => {
    expect(call[4], `${what} passed senderDisplayName to encryptAndSendDm`).toBeUndefined();
    expect(call[5], `${what} passed senderUserIcon to encryptAndSendDm`).toBeUndefined();
  };

  it('delivery-ack passes no sender identity arguments', async () => {
    await ctx.handlers.getHandler('send-delivery-ack')!.execute({
      address: PARTNER,
      messageIds: ['m1'],
      selfUserAddress: SELF,
    } as never);
    assertNoIdentityArgs(ctx.encryptAndSendDm.mock.calls[0], 'delivery-ack');
  });

  it('read-ack passes no sender identity arguments', async () => {
    await ctx.handlers.getHandler('send-read-ack')!.execute({
      address: PARTNER,
      upToMessageId: 'm9',
      upToTimestamp: 1,
      selfUserAddress: SELF,
    } as never);
    assertNoIdentityArgs(ctx.encryptAndSendDm.mock.calls[0], 'read-ack');
  });
});

describe('vector 3 — source sweep over the automatic-frame senders', () => {
  // The catch-all. Reads the real files rather than mocking, so a NEW control
  // frame added beside the existing ones is covered without anyone remembering
  // to extend the runtime tests above.
  //
  // Honest about its shape: it matches text, so it can be defeated by a
  // computed key or a spread. It exists to make the class loud, not to prove
  // absence.
  const REPO_ROOT = process.cwd();

  /** The object literal that follows a `type: '<frame>'` line, roughly. */
  function literalAround(source: string, marker: string): string {
    const at = source.indexOf(marker);
    if (at === -1) return '';
    // Walk back to the opening brace of the literal, then forward to its close.
    const open = source.lastIndexOf('{', at);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(open, i + 1);
      }
    }
    return source.slice(open, at + 400);
  }

  const AUTOMATIC_FRAMES: [string, string, string][] = [
    ['delivery-ack', 'src/services/ActionQueueHandlers.ts', "type: 'delivery-ack'"],
    ['read-ack', 'src/services/ActionQueueHandlers.ts', "type: 'read-ack'"],
  ];

  it.each(AUTOMATIC_FRAMES)(
    '%s is constructed with no identity field',
    (frame, file, marker) => {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      const literal = literalAround(source, marker);
      // If this is empty the marker moved and the sweep is silently testing
      // nothing — fail loudly rather than pass vacuously.
      expect(literal, `could not locate the ${frame} literal in ${file}`).not.toBe('');
      expect(literal).toContain(marker);
      for (const k of IDENTITY_KEYS) {
        expect(
          new RegExp(`\\b${k}\\b`).test(literal),
          `${frame} literal in ${file} mentions "${k}"`
        ).toBe(false);
      }
    }
  );

  it('the typing control forwarder does not attach identity on the way out', () => {
    // `sendEphemeralDMControl` is the ONLY path a typing frame takes out of
    // this client. It must hand the message to `encryptAndSendDm` with four
    // arguments — never the two optional identity ones.
    const source = readFileSync(resolve(REPO_ROOT, 'src/services/MessageService.ts'), 'utf8');
    const fn = source.slice(
      source.indexOf('async sendEphemeralDMControl('),
      source.indexOf('async sendEphemeralSpaceControl(')
    );
    expect(fn, 'sendEphemeralDMControl not found — the sweep is testing nothing').not.toBe('');
    expect(fn).toContain('encryptAndSendDm');
    for (const k of IDENTITY_KEYS) {
      expect(
        new RegExp(`\\b${k}\\b`).test(fn),
        `sendEphemeralDMControl mentions "${k}"`
      ).toBe(false);
    }
  });
});
