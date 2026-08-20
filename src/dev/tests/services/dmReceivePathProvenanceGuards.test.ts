/**
 * SOURCE-LEVEL GUARDS for the DM receive path's provenance wiring.
 *
 * ⚠️ WHY THIS FILE EXISTS, and it is not a nice-to-have.
 *
 * A test-coverage review MEASURED the following on this branch, by reverting
 * the real source and running the suite:
 *
 *   - Forcing `authenticatedSenderIsSelf = true` (which IS the pre-fix state of
 *     the conversation-destruction vulnerability) left **847/847 tests green**.
 *   - Breaking the capture of `authenticatedDmSender` left the same 847 green.
 *
 * So both halves of the receive-path wiring were protected by nothing in
 * `yarn test:run`. The only instrument that caught them was
 * `yarn harness dm-selfdelete-forgery`, which is opt-in and talks to the
 * PRODUCTION RELAY — so in practice a regression would reach main.
 *
 * The behavioural test next door (`MessageService.authenticatedSenderStamp`)
 * does not cover this: it calls `saveMessage` directly with hand-picked
 * arguments, which proves the wrapper stamps correctly but says nothing about
 * whether the ~8000-line receive path hands it the right values.
 *
 * ⚠️ WHY SOURCE TEXT RATHER THAN BEHAVIOUR. The code under test lives inside
 * `handleNewMessage`, a single method that needs a live Double-Ratchet session,
 * a real inbox, IndexedDB and a websocket to reach. There is no harness that
 * can drive a frame through it offline. Mobile hit the identical wall and
 * reached the identical answer (`__tests__/dmSelfEchoGuards.test.ts`); this is
 * desktop's equivalent, which it never had.
 *
 * Be honest about what this can and cannot do: it matches text, so a
 * semantically-equivalent reformat passes it, and it cannot prove the code is
 * correct. What it CAN do is make the specific known-dangerous edits loud
 * instead of silent. That is strictly better than 847 green tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/services/MessageService.ts'),
  'utf8'
);
const LINES = SOURCE.split('\n').map((l) => l.trim());

/** Index of the first line exactly equal to `needle`, or -1. */
const lineOf = (needle: string) => LINES.indexOf(needle);

describe('the authenticated sender is captured BEFORE the self-echo rewrite', () => {
  // `session.user_address` is overwritten a few lines below its capture, to
  // repoint the conversation at the partner for our own echoed messages. Read
  // after that point it names the WRONG party. Both derived values must
  // therefore be taken before it.
  const CAPTURE_IS_SELF =
    'const authenticatedSenderIsSelf = session.user_address === self_address;';
  const CAPTURE_SENDER = 'const authenticatedDmSender = session.user_address;';
  const REASSIGNMENT = 'session.user_address = decryptedContent!.channelId;';

  it('both captures exist exactly once', () => {
    expect(LINES.filter((l) => l === CAPTURE_IS_SELF)).toHaveLength(1);
    expect(LINES.filter((l) => l === CAPTURE_SENDER)).toHaveLength(1);
    expect(LINES.filter((l) => l === REASSIGNMENT)).toHaveLength(1);
  });

  it('both captures come BEFORE the reassignment', () => {
    const reassignedAt = lineOf(REASSIGNMENT);
    expect(reassignedAt).toBeGreaterThan(-1);
    // If either capture moves below the rewrite, the value silently becomes the
    // recipient instead of the sender — no error, no test failure, wrong answer.
    expect(lineOf(CAPTURE_IS_SELF)).toBeLessThan(reassignedAt);
    expect(lineOf(CAPTURE_SENDER)).toBeLessThan(reassignedAt);
  });
});

describe('delete-conversation-self requires the CRYPTO-authenticated sender', () => {
  // THE VULNERABILITY THIS PINS: the gate used to check only
  // `content.senderId === self_address`. That field is plaintext the sender
  // writes, so any peer could seal a frame naming the victim and this client
  // would delete the named conversation and every message in it.
  //
  // MEASURED before the fix, against the production relay:
  //   [selfdel] conversationBefore=true after=false messagesBefore=2 after=0

  it('the gate still ANDs in authenticatedSenderIsSelf', () => {
    // Reverting this line is exactly the regression that left 847 tests green.
    expect(
      LINES.filter((l) => l === 'authenticatedSenderIsSelf'),
      'the delete-conversation-self gate lost its crypto-authenticated half — a stranger can delete conversations'
    ).toHaveLength(1);
  });

  it('the gate is never satisfied by the payload alone', () => {
    // Guard against the specific vulnerable shape coming back, in either the
    // one-line or multi-line form.
    const collapsed = SOURCE.replace(/\s+/g, ' ');
    expect(
      collapsed.includes(
        "decryptedContent.content.senderId === self_address && authenticatedSenderIsSelf"
      ),
      'the payload check and the crypto check must both be present in the gate'
    ).toBe(true);
  });
});

describe('every DM receive save passes the authenticated sender, not a rewritten one', () => {
  // The three init-path saves (first save, plus the retry-once pair) must all
  // hand `saveMessage` the pre-rewrite capture. Passing `session.user_address`
  // here instead would compile, run, and stamp the recipient on inbound rows.
  it('all three init-path saves pass authenticatedDmSender', () => {
    expect(
      LINES.filter((l) => l === 'authenticatedDmSender,'),
      'an init-path saveMessage stopped passing the pre-rewrite sender'
    ).toHaveLength(3);
  });

  it('authenticatedDmSender is declared once and used only by those saves', () => {
    // 1 declaration + 3 save arguments. A 5th occurrence means someone started
    // using it somewhere new (fine, but it should be a deliberate edit here);
    // a 4th or fewer means a save site stopped receiving it.
    const occurrences = SOURCE.match(/\bauthenticatedDmSender\b/g) ?? [];
    expect(
      occurrences,
      'the wiring of the pre-rewrite sender into the DM saves changed — re-verify each save site'
    ).toHaveLength(4);
  });
});

describe('local-only fields are stripped centrally, not per send site', () => {
  // Three separate sites used to hand-list `{ sendStatus, sendError }`, and
  // when `authenticatedSenderId` was added none of them learned about it — so a
  // retried DM put a field documented as NEVER TRANSMITTED onto the wire.
  it('the strip helper exists and is the only list of local-only fields', () => {
    expect(SOURCE).toContain('export function stripNonTransmissibleFields');
    expect(SOURCE).toContain('authenticatedSenderId: _authenticatedSenderId,');
  });

  it('both WIRE paths go through the helper', () => {
    // Only these two re-serialize a stored row for encryption. The remaining
    // inline `{ sendStatus, sendError, ...rest }` destructure in the SPACE
    // retry is deliberately left alone: it feeds `saveMessage`, not an encrypt
    // call, and `saveMessage` re-stamps the marker from its own argument
    // afterwards. Narrowed to the wire paths on purpose — a blanket ban on the
    // inline form would fail on that save and teach the next reader to delete
    // the assertion rather than think about it.
    expect(
      SOURCE,
      'the DM retry stopped stripping local-only fields before encrypting'
    ).toContain('stripNonTransmissibleFields(failedMessage)');
    expect(
      SOURCE,
      'the space send stopped stripping local-only fields before encrypting'
    ).toContain('stripNonTransmissibleFields(message)');
  });
});
