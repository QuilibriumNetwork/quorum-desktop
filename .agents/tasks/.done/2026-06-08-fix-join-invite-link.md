---
type: task
title: Fix joinInviteLink — handle new server response shape + use eval's ephemeral key
status: done
created: 2026-06-08
updated: 2026-06-12
branch: session-2026-06-08-3 (rename to feat/fix-join-invite-link on commit)
---

# Fix `joinInviteLink` — public invite join is broken end-to-end

## What

Two independent bugs in `InvitationService.joinInviteLink` (lines 568-606) make joining a public invite link impossible. Both are pre-existing — the 2026-06-07 consolidation explicitly skipped the join path under the (now-known-wrong) assumption that it already handled both public and private flows correctly. Mobile's join code has the right handling; we adapt it to desktop.

## Why now

User hit the crash while smoke-testing PR #182 (#29 non-owner invite view). Every join attempt through the public-invite path fires the crash. Mobile users joining via the same links succeed.

## Root causes (verified, not speculation)

### Bug 1 — `"[object Object]" is not valid JSON` crash

**Where**: [`src/services/InvitationService.ts:593`](../../src/services/InvitationService.ts#L593): `ciphertext: JSON.parse(inviteEval.data)`

**Why**: The base API client at [`src/api/baseTypes.ts:341-343`](../../src/api/baseTypes.ts#L341) reads `Content-Type` and either does `response.json()` (parses) or `response.text()` (raw string). The server now returns the eval as a JSON object `{ciphertext: "<inner-json-string>", ephemeral_public_key: "<hex>"}`. The base client parses it automatically. Then desktop's join code does a second `JSON.parse(inviteEval.data)` assuming it's still a string — `JSON.parse(object)` coerces via `String(obj)` → `"[object Object]"` → SyntaxError.

**Mobile parity**: [`quorum-mobile/services/api/quorumClient.ts:710-738`](../../../quorum-mobile/services/api/quorumClient.ts#L710) defensively handles BOTH shapes — `typeof response === 'string'` (legacy) AND `'ciphertext' in response` (current). Returns a normalized `{ciphertext: string, ephemeralPublicKey: string | null}` shape to its consumer.

### Bug 2 — long-standing intermittent "expired/invalid" failure

**Where**: [`src/services/InvitationService.ts:591`](../../src/services/InvitationService.ts#L591): `ephemeral_public_key: hexToSpreadArray(manifest.data.ephemeral_public_key)`

**Why**: Every `broadcastSpaceUpdate` (kick, role grant, settings edit, channel binding, etc.) re-encrypts the space manifest with a fresh ephemeral key but leaves the eval untouched. After any space update, the manifest's ephemeral key no longer matches the eval's ephemeral key — eval decryption fails — user gets "expired/invalid link".

**Mobile parity**: [`quorum-mobile/hooks/chat/useSpaceActions.ts:271-279`](../../../quorum-mobile/hooks/chat/useSpaceActions.ts#L271):
```ts
// Use the eval's own eph key when the server provides it; only fall back to
// the manifest's key on legacy servers that don't yet return it.
const evalEphPubKeyBytes = evalResponse.ephemeralPublicKey
  ? hexToBytes(evalResponse.ephemeralPublicKey)
  : ephemeralPublicKeyBytes;
```

**Existing bug reports this resolves**:
- [`.agents/bugs/2025-08-03-joinspacemodal-invalid-json-network-error.md`](../bugs/2025-08-03-joinspacemodal-invalid-json-network-error.md) — title says "network issues" but the underlying root cause is Bug 1 (server response-shape mismatch). The "regenerate the public link" workaround happened to work intermittently because regenerating re-uploads the manifest with a fresh ephemeral key that briefly matches the new eval's ephemeral key.
- [`.agents/bugs/2025-09-22-public-invite-link-intermittent-expiration.md`](../bugs/2025-09-22-public-invite-link-intermittent-expiration.md) — already marked `likely-resolved-by-consolidation`, but the marker was wrong. The mobile-side server change to "serve the same eval to every joiner instead of popping one per join" was necessary but not sufficient — desktop's client code never picked up the eval-side ephemeral key change.

## Files to modify

### 1. [`src/api/baseTypes.ts`](../../src/api/baseTypes.ts) — normalize at the API layer

Change `getSpaceInviteEval` so callers get a clean `{ciphertext: string, ephemeralPublicKey: string | null}` shape regardless of which response form the server returns. Mirror mobile's `getInviteEval`. Two changes:

- Return type: replace `Promise<{data: string}>` (via `post<string>`) with `Promise<{ciphertext: string, ephemeralPublicKey: string | null} | null>`.
- Send the body as `text/plain` (raw string) to match mobile's content type. Currently desktop wraps in `JSON.stringify` and sends `application/json` — see Open question below.
- On 404 (eval missing — owner never published a public invite or it was deleted): return `null` so the caller can throw a friendly `"This public invite link is no longer valid."` error.

### 2. [`src/services/InvitationService.ts`](../../src/services/InvitationService.ts) lines 568-606 — consume the normalized shape

Rewrite the public-invite branch to:
- Handle the `null` from a 404 (currently catches `isQuorumApiError(e) && e.status === 404` — that needs to keep working since the base layer might still throw for 4xx; we'll mirror both paths).
- Pick the right ephemeral key: prefer the eval's own `ephemeralPublicKey` when present, fall back to `manifest.data.ephemeral_public_key`.
- `JSON.parse(normalized.ciphertext)` once to get the inner sealed envelope.

The rest of the function (template assembly, hub registration, etc., lines 614+) doesn't change.

### 3. Bug reports

Both bug reports get a `fix-in-flight-awaiting-verification` status update **in this PR**, with a closing note describing the proposed fix and the verification gates. They stay in `.agents/bugs/` (NOT `.solved/`) until end-to-end smoke testing confirms the fix in a real session.

- [`.agents/bugs/2025-08-03-joinspacemodal-invalid-json-network-error.md`](../bugs/2025-08-03-joinspacemodal-invalid-json-network-error.md): misattributed to "network issues"; real cause is the response-shape mismatch in Bug 1 above.
- [`.agents/bugs/2025-09-22-public-invite-link-intermittent-expiration.md`](../bugs/2025-09-22-public-invite-link-intermittent-expiration.md): the existing `likely-resolved-by-consolidation` marker turned out to be over-optimistic — the mobile-side server change was necessary but not sufficient. This PR addresses the desktop-side client change.

Moving both to `.solved/` happens in a **follow-up commit/PR after verification**, not in this PR.

## Out of scope

- Mobile-side changes (mobile already does the right thing).
- `quorum-shared` changes (none needed — the shape lives in the API client layer).
- Refactoring the rest of `joinInviteLink` (614-852). Hub registration, encryption-state save, join-message send — all untouched.
- The 2025-08-03 bug report's proposed "retry on JSON parse error" — that was treating a symptom; the underlying response-shape mismatch is being fixed, no retry needed.

## Open question

The current desktop call:
```ts
return this.post<string>(getSpaceInviteEvalUrl(), {
  headers,
  timeout,
  body: configPublicKey,  // a hex string
});
```

The base `post` always wraps the body in `JSON.stringify(rawBody)` ([baseTypes.ts:223](../../src/api/baseTypes.ts#L223)) and sends `Content-Type: application/json`. So the server receives `"deadbeef..."` (a JSON-encoded string) instead of mobile's raw `deadbeef...` with `Content-Type: text/plain`.

The server might be tolerant (just strips outer quotes), but we should match mobile's behavior to avoid future divergence. **Decision needed during implementation**: do we (a) keep desktop's behavior since it works for the request side and only fix the response handling? Or (b) also align the request side to mobile?

Going with (a) for the smallest possible fix — the response side is the only thing causing failures. We can align the request side later if it ever matters.

## Smoke test plan

Each test below should be tried with two combinations:
- Public link, "fresh" — owner has just published or republished the public invite.
- Public link, "stale" — owner published the public invite, THEN updated the space (added/removed a channel, kicked someone, edited settings) at least once after.

The stale combination is the one that's been failing for months pre-fix (Bug 2).

**As a non-owner attempting to join via a public invite link**:
- [ ] Fresh public link: clicking the invite link opens JoinSpaceModal → "Join" button → space joined successfully, lands in the default channel.
- [ ] Stale public link (owner has updated the space since publishing): same flow succeeds. **This is the long-standing bug — should now work consistently.**
- [ ] Server returns 404 (invalid configPublicKey): user sees a friendly "This public invite link is no longer valid." error, not a stack trace.

**As an existing member attempting to join via a public invite link they already have**:
- [ ] Membership-conflict path still surfaces the "already a member" message (this lives elsewhere in the flow, just verifying no regression).

**As any user joining via a one-time / private invite link** (separate code path — `info.secret && info.template && info.hubKey` are all set in the URL):
- [ ] Still works end-to-end. The fix only touches the public branch; private should be untouched.

Cross-cutting:
- [ ] Type check (`npx tsc --noEmit`) passes.
- [ ] `yarn lint` passes.
- [ ] No unit test changes needed (`InvitationService.unit.test.tsx` doesn't cover this branch — see the test docs).

## Repo workflow notes

- Branch was `session-2026-06-08-3` (per session-branch naming); rename to `feat/fix-join-invite-link` when scope crystallizes (now).
- The pending audit-folder commit from the prior #29 ship rides with this PR per the doc-bundling rule.
- Two bug reports move from `.agents/bugs/` → `.agents/bugs/.solved/` in this PR.

---

## Resolution (2026-06-12)

Done and merged to `main`. Both bugs fixed as planned:
- `baseTypes.ts` `getSpaceInviteEval` normalizes both response shapes into `{ciphertext, ephemeralPublicKey}` (`baseTypes.ts:630`).
- `joinInviteLink` consumes the normalized shape, prefers the eval's ephemeral key with manifest fallback (`InvitationService.ts:595`), parses `ciphertext` once (`:604`), throws a friendly "no longer valid" error on missing eval (`:580`).
- Merged via PR #183 (code) and PR #184 (docs + bug closeout).
- Both bug reports moved to `.agents/bugs/.solved/`: `2025-08-03-joinspacemodal-invalid-json-network-error.md`, `2025-09-22-public-invite-link-intermittent-expiration.md`.

*Last updated: 2026-06-12*
