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
  (`quilibrium-js-sdk-channels/dist/index.js` ~line 5945): it **always**
  `NewDeviceKeyset()`, fetches `existing.device_registrations`, and
  `ConstructUserRegistration(ident, existing, [newDevice])` — appends, never
  reuses `KeyDB id=2`, never prunes. → +1 ghost per reset+reimport.
- Note: a plain reload WITHOUT reimport reuses `KeyDB id=2` via
  [`RegistrationPersister.tsx:158`](../../src/components/context/RegistrationPersister.tsx#L158)
  and does NOT mint. The reset only triggers the bug because it clears the
  localStorage session (`App.tsx:84` reads `currentPasskeyInfo` from
  `localStorage['passkeys-list']`; once null, `App.tsx:132` routes to
  `OnboardingFlow`, not `RegistrationProvider`) and forces the reimport.
- Correction (independent review 2026-07-21): the `NewDeviceKeyset()` at
  `RegistrationPersister.tsx:115` is NOT reachable on a transient network error.
  It requires `registration.registered === false` (a hub 404 — transient fetch
  errors throw/suspend, they don't return `registered:false`) AND
  `loadKeyDecryptData(2)` failing (KeyDB id=2 absent/corrupt). So that line is a
  permanent-corruption path, not a routine one. The reset→reimport chain via the
  SDK's `buildAndUploadRegistration` is the real accumulation vector.

### Mobile mechanism

- Mobile is architecturally more resilient: `initializeEncryptionKeys` REUSES
  the SecureStore device keyset if present (`keyService.ts:527-543`) and
  `uploadUserRegistration` DEDUPES by `inbox_address` before appending
  (`keyService.ts:719-722`). So normal re-logins do NOT accumulate.
- But "Reset App Data" → `signOut()` (`context/AuthContext.tsx:467`) calls
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
  userPrivateKey, thisInboxAddress)` already exists (`keyService.ts:873`) — it
  just isn't called on reset.

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
2. Then run the existing wipe (quorum_db + localStorage + sessionStorage + reload).
3. (Secondary, optional) also delete `KeyDB` so the reset actually honors its own
   copy ("delete your private keys") — see "Secondary" below; must run AFTER the
   deregister since the deregister needs the master key.
4. **Observable outcome:** on a second device, open the device list; reset device
   A; A disappears from the list instead of piling up. Re-login on A adds exactly
   one entry (the new A), total device count stays flat across reset cycles.
5. Unit test the "reconstruct registration without current device" pure logic
   (input device list + this inbox → expected remaining list; last-device case).

### Slice 2 — Mobile (mirror)

1. In the reset flow (`ProfileModal.handleResetAppData` → before `signOut()`, or
   inside `signOut` guarded by a `deregister` flag so ordinary logout can opt in
   too): read `getPrivateKey()`/`getPublicKey()`/`getInboxAddress()` and call
   `removeDeviceFromRegistration(...)` before `clearAllSecureStorage()`.
   Best-effort with timeout.
2. Then `clearAllMMKVStorage()` + `clearAllSecureStorage()` as today.
3. **Observable outcome:** same as desktop, verified statically + on a real
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
  to leave 0 devices (`keyService.ts:902-904`); desktop's filter has no such
  guard. Removing the last device empties `device_registrations`. OPEN: confirm
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
  Not catastrophic (self-consistent), but means a failed wipe undoes the
  cleanup. Acceptable; note it so it isn't mistaken for the fix "not working."
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

## Tie-in: per-device signing keys

Once the send-side of
[2026-07-19-per-device-signing-keys-registration-anchored.md](2026-07-19-per-device-signing-keys-registration-anchored.md)
lands, device removal broadcasts `revoke-device` per space. Deregister-on-reset
should also fire that broadcast (before the wipe), or the reset leaves stale
per-device signing admissions in other members' `space_member_devices` stores.
Keep this dependency in mind; it does not block Slices 1-2 (revoke-device
send-side isn't shipped yet), but the reset deregister and the revoke broadcast
should share one code path when they converge.

Be precise about scope (independent review 2026-07-21): deregister-on-reset
removes the device from the HUB `UserRegistration` (so new DMs can't be sealed to
it) but does NOT clear that device's admission rows already sitting in other
members' local `space_member_devices` stores — those only clear via a
`revoke-device` broadcast (not shipped) or some later cleanup. So this fix is
"complete for the hub registration, not yet for space signing admissions." State
that plainly rather than implying the ghost is fully erased everywhere.

### Conflict check vs the per-device-signing feature (#244 / #245) — verified 2026-07-21

Question raised: could deregister-on-reset conflict with the per-device signing
work already merged (#244 interim per-user signing key; #245 desktop receive-side
of per-device keys)? **Conclusion: no conflict with shipped code; it is a
convergence point for the future send-side.** Verified against source:

- **DangerZone overlap is harmless.** #245's only `DangerZone.tsx` change was
  making a *blocked* IDB delete reject instead of silently resolving. This fix
  adds a deregister step *before* the wipe — orthogonal, stacks cleanly.
- **Signing admissions are anchored to the master key, not the hub device list
  this fix mutates.** `quorum-shared/src/utils/deviceKeys.ts:194` verifies via
  `deriveInboxAddress(userPublicKey) === userAddress` + the master-key signature;
  it NEVER fetches or checks `UserRegistration.device_registrations[]`. So
  removing a device from the hub list invalidates no admission and breaks no
  verification. Different anchor.
- **No send-side exists to collide with.** `MessageService.ts` has RECEIVE
  handlers for `announce-keys`/`revoke-device` (~lines 986, 4974) but nothing
  BROADCASTS them. Send-side is unshipped on both platforms.
- **Mobile: same.** Its space signing key is per-user (shared via config), not
  tied to the DM device registration, so `removeDeviceFromRegistration` on reset
  doesn't touch it.

Two items for the convergence (when send-side + revocation lands — NOT now):
1. The await-before-wipe discipline must extend to the `revoke-device` broadcast
   too (don't wipe keys/connection before it propagates — same trap as the
   registration upload).
2. Reset revokes the CURRENT device (self-revocation), whereas the per-device
   plan frames revocation around removing OTHER devices. A device revoking itself
   right before wiping is a slightly different flow — should be fine (master-
   signed, LWW) but flag it to the lead when the send-side is designed.

## Files (anticipated)

Desktop:
- `src/components/modals/UserSettingsModal/DangerZone.tsx` — deregister step +
  best-effort/timeout + notice; optional KeyDB delete.
- (wiring) registration context / keyset access into DangerZone.
- new unit test for the reconstruct-without-current-device logic.

Mobile:
- `components/ProfileModal.tsx` (`handleResetAppData`) and/or
  `context/AuthContext.tsx` (`signOut`) — call `removeDeviceFromRegistration`
  before `clearAllSecureStorage`.

## Secondary (do NOT bundle silently)

Desktop reset copy claims it deletes "your private keys" but `KeyDB` survives
(only `quorum_db` is deleted). Deleting `KeyDB` on reset would honor the copy and
is a real hardening, but it interacts with the app-lock / duress-wipe work
([2026-06-22-app-lock-password-gate-research.md](../../.agents/reports/2026-06-22-app-lock-password-gate-research.md)).
Decide explicitly (with the lead if needed); don't fold it into the ghost fix
without calling it out.

*Last updated: 2026-07-21*
