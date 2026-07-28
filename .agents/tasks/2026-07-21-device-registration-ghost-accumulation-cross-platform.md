---
type: task
title: "Ghost device accumulation on reset/logout — deregister-before-wipe (desktop + mobile)"
status: PLAN — not started
priority: medium (UX/hygiene; not a security hole, but pollutes the device list and per-device-signing admissions)
created: 2026-07-21
platforms: quorum-desktop + quorum-mobile (+ optional quilibrium-js-sdk-channels hardening)
related:
  - .agents/tasks/2026-07-19-per-device-signing-keys-registration-anchored.md (revoke-device tie-in)
  - .agents/docs/features/onboarding-flow.md (KeyDB id=2 / registration flow)
  - .agents/reports/2026-06-22-app-lock-password-gate-research.md (reset flow + duress-wipe; KeyDB-not-deleted note)
---

# Ghost device accumulation on reset/logout

## Symptom (observed)

A test account used across ~3-4 physical devices shows **10+ devices** in the
device list. The user resets app data and re-logs-in frequently on those
devices; each cycle adds a device entry that is never removed.

## Root cause (verified in source, both platforms)

Reset/logout **destroys the local device keyset without first removing that
device's entry from the hub `UserRegistration.device_registrations[]`.** The
device keyset is the ONLY local handle to its hub entry, so once wiped the entry
is orphaned (only manual device-list removal can clear it). Each re-login then
mints a FRESH device keyset (new `inbox_address`) and appends it → ghosts
accumulate.

Key distinction: a genuinely NEW physical device legitimately has no keyset to
reuse, so minting there is correct. The bug is exclusively the SAME device
re-registering after its local keyset was wiped. Any fix must therefore key off
"the device being wiped," not a reuse/fingerprint heuristic.

### Desktop mechanism

- Reset ([`DangerZone.tsx` `handleResetAppData`](../../src/components/modals/UserSettingsModal/DangerZone.tsx)):
  `queryClient.clear()` → `indexedDB.deleteDatabase('quorum_db')` →
  `localStorage.clear()` → `sessionStorage.clear()` → reload.
  - Deletes `quorum_db` and the **localStorage passkey session**
    (`passkeys-list`, `${prefix}-master`) → app can no longer auto-resume the
    account → user is forced to re-onboard/re-import.
  - Does **NOT** delete the separate `KeyDB` database (SDK: `indexedDB.open('KeyDB', 1)`),
    so the device/master keys physically survive — but they're bypassed because
    the session is gone.
- Re-import path runs the SDK's `buildAndUploadRegistration`
  (`@quilibrium/quilibrium-js-sdk-channels/dist/index.js` ~line 5857): it **always**
  `NewDeviceKeyset()`, fetches `existing.device_registrations`, and
  `ConstructUserRegistration(ident, existing, [newDevice])` — appends, never
  reuses `KeyDB id=2`, never prunes. → +1 ghost per reset+reimport.
- Note: a plain reload WITHOUT reimport reuses `KeyDB id=2` via
  [`RegistrationPersister.tsx:158`](../../src/components/context/RegistrationPersister.tsx#L158)
  and does NOT mint. The reset only triggers the bug because it clears the
  localStorage session (`App.tsx` gets `currentPasskeyInfo` from the passkeys
  context, backed by `localStorage['passkeys-list']`; once null, `App.tsx:135`
  routes to `OnboardingFlow`, not `RegistrationProvider`) and forces the reimport.
- Correction (independent review 2026-07-21): the `NewDeviceKeyset()` at
  `RegistrationPersister.tsx:115` is NOT reachable on a transient network error.
  It requires `registration.registered === false` (a hub 404 — transient fetch
  errors throw/suspend, they don't return `registered:false`) AND
  `loadKeyDecryptData(2)` failing (KeyDB id=2 absent/corrupt). So that line is a
  permanent-corruption path, not a routine one. The reset→reimport chain via the
  SDK's `buildAndUploadRegistration` is the real accumulation vector.

### Mobile mechanism

- Mobile is architecturally more resilient: `initializeEncryptionKeys` REUSES
  the SecureStore device keyset if present
  (`services/onboarding/keyService.ts:520-545`) and the registration upload
  DEDUPES by `inbox_address` before appending (same file, ~722-724). So normal
  re-logins do NOT accumulate.
- But "Reset App Data" → `signOut()` (`context/AuthContext.tsx`, clears at
  ~470-473) calls
  `clearAllMMKVStorage()` **and** `clearAllSecureStorage()` — wiping the device
  keyset (inbox signing/encryption keys, inbox_address, identity, prekey). On
  re-login, no keyset to reuse → a new one is generated → new `inbox_address` →
  the dedupe filter can't match the old orphaned entry → append. Same ghost.

## The fix: deregister-before-wipe (symmetric, uses existing machinery)

Reset must remove THIS device from the hub registration **while the keys are
still present**, then wipe. Both platforms already have the code:

- **Desktop:** `ConstructUserRegistration(userKeyset, remainingDevices, [])` +
  `uploadRegistration`, exactly as the removeDevice save path in
  [`useUserSettings.ts:522-534`](../../src/hooks/business/user/useUserSettings.ts#L522-L534).
  Current device's inbox_address = `keyset.deviceKeyset.inbox_keyset.inbox_address`.
- **Mobile:** `removeDeviceFromRegistration(userAddress, userPublicKey,
  userPrivateKey, thisInboxAddress)` already exists
  (`services/onboarding/keyService.ts:875`) — it just isn't called on reset.

### Slice 1 — Desktop (vertical, observable)

1. In `handleResetAppData`, before any wipe: obtain `keyset` (via the
   registration context) and the current device inbox_address. Build
   `remainingDevices = device_registrations.filter(d => d.inbox_registration.inbox_address !== thisInbox)`,
   `ConstructUserRegistration(keyset.userKeyset, remainingDevices, [])`, upload.
   **CRITICAL (independent review 2026-07-21): the upload MUST be awaited with a
   bounded timeout BEFORE the wipe/reload — not fire-and-forget.** `uploadRegistration`
   fires an HTTP request; `window.location.reload()` synchronously cancels
   in-flight `fetch`/XHR (unless `keepalive`), so a fire-and-forget deregister
   followed by an immediate reload silently drops the request even online. Use
   `await Promise.race([uploadDeregister(...), timeout(~3000ms)])`, then wipe.
   This is the #1 way the fix "passes in tests, fails in the field."
2. **(Added 2026-07-28 — send-side shipped in #249.)** Also before the wipe:
   broadcast the `revoke-device` tombstone for THIS device —
   `broadcastDeviceRevocations([thisInbox])`, exposed by `useMessageDB()` (the
   hook DangerZone needs anyway) and already wired into the Security-modal
   removal flow at
   [`useUserSettings.ts:536-544`](../../src/hooks/business/user/useUserSettings.ts#L536-L544).
   There it is fire-and-forget (the app stays alive); on reset it MUST be
   awaited with the same bounded timeout as step 1, or the reload cancels it.
   Without this, the reset cleans the hub list but leaves this device's
   signing-key admission live in members' `space_member_devices` stores.
3. Then run the existing wipe (quorum_db + localStorage + sessionStorage + reload).
4. (Secondary, optional) also delete `KeyDB` so the reset actually honors its own
   copy ("delete your private keys") — see "Secondary" below; must run AFTER the
   deregister since the deregister needs the master key.
5. **Observable outcome:** on a second device, open the device list; reset device
   A; A disappears from the list instead of piling up. Re-login on A adds exactly
   one entry (the new A), total device count stays flat across reset cycles.
6. Unit test the "reconstruct registration without current device" pure logic
   (input device list + this inbox → expected remaining list; last-device case).

### Slice 2 — Mobile (mirror)

1. In the reset flow (`ProfileModal.handleResetAppData` → before `signOut()`, or
   inside `signOut` guarded by a `deregister` flag so ordinary logout can opt in
   too): read `getPrivateKey()`/`getPublicKey()`/`getInboxAddress()` and call
   `removeDeviceFromRegistration(...)` before `clearAllSecureStorage()`.
   Best-effort with timeout.
2. **(Added 2026-07-28 — send-side shipped in mobile #168.)** Also broadcast
   `revoke-device` for THIS device before the wipe: ProfileModal already
   broadcasts it on device *removal* (via the `deviceKeyStatements` service,
   `services/space/deviceKeyStatements.ts`) — reuse that path for the current
   device's inbox address, awaited with timeout.
3. Then `clearAllMMKVStorage()` + `clearAllSecureStorage()` as today.
4. **Observable outcome:** same as desktop, verified statically + on a real
   device pair (mobile: prefer statically-verifiable change per quorum-atlas;
   confirm on-device with the dual-device preview setup if available).

### Slice 3 — SDK hardening (raise with lead; optional, not required for the fix)

Desktop SDK `buildAndUploadRegistration` should reuse the existing `KeyDB id=2`
device keyset when present (mirror mobile's `initializeEncryptionKeys` reuse) so
that re-importing on a device that already holds the account does not mint a
duplicate even without a reset. Wire-compatible, but it's the lead's SDK repo →
propose via Telegram, don't self-merge.

## Edge cases / decisions

- **Offline at reset time:** the deregister upload will fail. Reset must NOT be
  blockable (users often reset precisely when things are broken/offline). Chosen
  behavior: attempt with a short timeout; on failure, proceed with the wipe
  anyway and surface a non-blocking notice ("couldn't reach the network; this
  device may remain listed until you remove it manually"). Accept the rare
  residual ghost. This keeps the common (online) path clean and reset reliable.
- **Last device on the account:** mobile's `removeDeviceFromRegistration` refuses
  to leave 0 devices (`services/onboarding/keyService.ts` ~903-909 — it also
  returns false if the device isn't in the list at all); desktop's filter has no
  such guard. Removing the last device empties `device_registrations`. OPEN: confirm
  the server accepts an empty device list on upload. If it does, allow reset to
  remove the last device (fully clean). If it rejects empty, accept a ≤1 residual
  ghost from single-device accounts — still a massive improvement over 10+.
  → Verify server behavior before finalizing mobile's last-device path.
- **No reuse/fingerprint heuristic needed:** deregister removes exactly the
  device being orphaned; a different real device (never reset) is never touched.
- **Partial completion — deregister succeeds but wipe fails (blocked delete /
  other tab):** the device is now off the hub but still local. On the next app
  open WITHOUT a wipe, `RegistrationPersister` (registered:true path,
  lines 186-209) finds the current inbox_address missing from
  `device_registrations` and silently re-appends it — reversing the deregister.
  (Re-append is at lines 187-210 in current code.) Same symmetry on the signing
  side since #249/#168: both platforms re-announce this device's key per space
  on connect, so a failed wipe also re-admits the just-revoked signing key.
  Not catastrophic (self-consistent in both directions), but means a failed wipe
  undoes the cleanup. Acceptable; note it so it isn't mistaken for the fix "not
  working."
- **`keyset` not ready at reset time (desktop):** `RegistrationContext` default
  is `keyset: undefined as never` and RegistrationPersister populates it after a
  ~200ms init. A user who opens Settings and types RESET faster than that could
  see `keyset === undefined` → guard: if keyset/inbox unavailable, skip the
  deregister and proceed with the wipe (fall back to old behavior, no crash).
- **Non-reset ghost vectors (out of scope here, but real — don't claim this fix
  eliminates ALL accumulation):** (a) the `clickRestore`/"Reauthorize" path in
  RegistrationPersister can hit `NewDeviceKeyset()` under
  registered:false + KeyDB-corrupt + repeated passkey denial; (b) pasting a key
  in Security settings without a reset. Both obscure; neither is fixed by
  deregister-on-reset. Frame the fix as "stops the reset-driven accumulation,"
  not "no device can ever be orphaned."
- **Cleaning up EXISTING ghosts:** manual removal via the existing device-list UI
  (desktop Security modal, mobile device management). No migration needed; just
  document it for the test accounts.

## Tie-in: per-device signing keys — NOW LIVE (superseded 2026-07-28)

> Original framing ("once the send-side lands…") is obsolete: the send-side
> shipped on BOTH platforms the same day this task was written — desktop #249
> (`08ef96ea0`, announce + `broadcastDeviceRevocations` wired into the
> Security-modal removal flow) and mobile #168 (`2609a78`, receive + send +
> revoke-on-removal in ProfileModal). Both include the Option A signing flip
> (fresh devices sign with their OWN per-device inbox key and announce it on
> connect). Both are merged to main, prod-gated on cross-device validation.

Consequences for this task:

1. **The ghost problem gained a second dimension.** Each reset+re-login cycle
   now also announces a NEW per-device signing key into every member's
   `space_member_devices` store, and the wiped device's old admission is never
   revoked. Stale admissions accumulate exactly like hub ghosts.
2. **The revoke broadcast is part of Slices 1-2** (step 2 in each), not a
   future convergence item. The machinery exists on both platforms; reset just
   has to call it for the current device before wiping — awaited, same
   reload-cancels-fetch trap as the registration upload.
3. **Self-revocation is a new flow** — the existing broadcasts revoke OTHER
   devices; reset revokes the device doing the broadcasting, right before it
   wipes. Master-signed + LWW (`quorum-shared/src/utils/deviceKeys.ts`
   `~194`: verdicts anchor on `deriveInboxAddress(userPublicKey) ===
   userAddress` + master signature + strictly-newer timestamp), so it should
   verify identically, but flag it to the lead before implementing.

Scope stays honest: deregister cleans the hub `UserRegistration` (new DMs can't
be sealed to the ghost) and the revoke tombstone clears its signing admission in
stores of members that receive the broadcast; members that never see it keep the
stale admission until later cleanup. Say that plainly rather than implying the
ghost is fully erased everywhere.

### Conflict check vs the per-device-signing feature — re-verified 2026-07-28

Original check (2026-07-21, against #244/#245) concluded "no conflict with
shipped code; convergence point for the future send-side." Re-verified after
#249 (desktop send) and #168 (mobile send) landed — **still no conflict**, and
the convergence is no longer future (see tie-in above). Current state:

- **DangerZone overlap is harmless.** #245's only `DangerZone.tsx` change was
  making a *blocked* IDB delete reject instead of silently resolving. This fix
  adds a deregister step *before* the wipe — orthogonal, stacks cleanly.
  (Re-confirmed: `DangerZone.tsx` today is exactly the wipe sequence described
  above, no deregister, no KeyDB delete.)
- **Signing admissions are anchored to the master key, not the hub device list
  this fix mutates.** `quorum-shared/src/utils/deviceKeys.ts` (~194) verifies via
  `deriveInboxAddress(userPublicKey) === userAddress` + the master-key signature;
  it NEVER fetches or checks `UserRegistration.device_registrations[]`. So
  removing a device from the hub list invalidates no admission and breaks no
  verification. Different anchor.
- **Send-side now exists — and it's the machinery this fix reuses, not a
  collision.** Desktop `MessageService.ts`: statement receive at ~1117 /
  envelope dispatch ~5505; `announceDeviceKeys` ~1261; `broadcastDeviceRevocations`
  ~1312. The broadcasts are additive control ops; a deregister-before-wipe step
  doesn't interfere with them (it *calls* one of them, Slice 1 step 2).
- **Mobile mirrors desktop since #168** (the earlier "mobile signing key is
  per-user via config" note is superseded by the Option A flip). Same
  conclusion: reuse, not conflict.

(The two former "convergence items" — await-before-wipe for the broadcast, and
the self-revocation flag — are folded into Slice 1 step 2 and the tie-in
section above.)

## Files (anticipated)

Desktop:
- `src/components/modals/UserSettingsModal/DangerZone.tsx` — deregister +
  revoke-broadcast steps + best-effort/timeout + notice; optional KeyDB delete.
- (wiring) registration context / keyset access + `broadcastDeviceRevocations`
  (from `useMessageDB()`) into DangerZone.
- new unit test for the reconstruct-without-current-device logic.

Mobile:
- `components/ProfileModal.tsx` (`handleResetAppData`, ~852) and/or
  `context/AuthContext.tsx` (`signOut`) — call `removeDeviceFromRegistration` +
  the `deviceKeyStatements` revoke broadcast before `clearAllSecureStorage`.

## Secondary (do NOT bundle silently)

Desktop reset copy claims it deletes "your private keys" but `KeyDB` survives
(only `quorum_db` is deleted). Deleting `KeyDB` on reset would honor the copy and
is a real hardening, but it interacts with the app-lock / duress-wipe work
([2026-06-22-app-lock-password-gate-research.md](../../.agents/reports/2026-06-22-app-lock-password-gate-research.md)).
Decide explicitly (with the lead if needed); don't fold it into the ghost fix
without calling it out.

*Last updated: 2026-07-28*

## Review Log
**2026-07-28 - claude-fable-5**: Verified every source claim on desktop, mobile, SDK dist, and quorum-shared; core mechanics all hold, but the send-side premise was stale — updated the task to fold the now-shipped revoke-device broadcast into both slices.
- STALE (fixed): 'send-side unshipped on both platforms' was overtaken same-day — desktop #249 (08ef96ea0) and mobile #168 (2609a78) shipped announce/revoke broadcasts + Option A flip; rewrote the tie-in and conflict-check sections, added revoke-broadcast step 2 to Slice 1 (broadcastDeviceRevocations via useMessageDB, awaited before wipe) and Slice 2 (deviceKeyStatements path).
- New consequence documented: with the flip live, each reset cycle also accumulates stale signing-key admissions in members' space_member_devices stores — ghost problem has a second dimension.
- Verified intact: DangerZone wipe sequence (no KeyDB delete), RegistrationPersister branch structure (line 115 corruption-only path, 158 reuse, 187-210 re-append), SDK buildAndUploadRegistration always-mints (now ~5857), mobile reuse/dedupe/last-device guard, deviceKeys.ts master-key anchor + LWW.
- Pointer refreshes: SDK path needs @quilibrium/ scope; mobile keyService is services/onboarding/keyService.ts (875, ~903-909, ~520-545, ~722-724); App.tsx route now 135; added edge-case note that a failed wipe also re-admits the revoked signing key via on-connect re-announce (symmetric self-heal).
