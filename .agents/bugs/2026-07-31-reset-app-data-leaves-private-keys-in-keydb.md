---
type: bug
title: "\"Reset App Data\" does not delete the master private key on Electron and fallback-authenticator browsers"
status: OPEN — statically confirmed in source and in the shipped SDK bundle, NOT runtime-tested
created: 2026-07-31
severity: HIGH on Electron and fallback-authenticator browsers (the reset's own copy promises key deletion and does not do it; the surviving master key needs no passkey to decrypt). PRF-browser users and mobile are unaffected.
platforms: quorum-desktop — Electron always affected, browser only on fallback authenticators; quorum-mobile verified clean
related:
  - .agents/bugs/2026-07-31-electron-master-key-at-rest-no-user-secret.md (the underlying storage design; this bug is its residue-after-reset symptom)
  - .agents/tasks/.done/2026-07-21-device-registration-ghost-accumulation-cross-platform.md ("Secondary" — where this was first noted, and understated)
  - .agents/reports/2026-06-22-app-lock-password-gate-research.md (app-lock / duress-wipe — decide alongside)
  - .agents/docs/features/onboarding-flow.md (KeyDB id=1 / id=2, registration flow)
---

# Reset App Data leaves private keys behind (desktop)

> Surfaced 2026-07-31 while closing out the deregister-before-wipe work. The
> task file recorded only "KeyDB survives the reset", which understates it in
> the case that matters most: on Electron the surviving record is the **master
> private key itself**, and its decryption key is stored in the same record.
> Every claim below is re-verified in source; **exploitability is reasoned, not
> runtime-tested** — see "Confidence".

## What the UI promises

[`DangerZone.tsx`](../../src/components/modals/UserSettingsModal/DangerZone.tsx):

> "This will delete all your data from this browser, **including your private
> keys** and all direct messages. […] Make sure you have exported your private
> key from the Privacy/Security settings. This action cannot be undone."

## What actually happens

The reset deletes exactly one IndexedDB database:

```ts
const req = indexedDB.deleteDatabase('quorum_db');   // DangerZone.tsx
```

The SDK keeps key material in a **separate** database, `KeyDB` (object store
`KeyObjectStore`), opened in
`@quilibrium/quilibrium-js-sdk-channels/dist/index.js` (`callOnStore`, ~2336).
`deleteDatabase('quorum_db')` in DangerZone is the ONLY `deleteDatabase` call in
`src/` — nothing anywhere deletes `KeyDB`. It survives the reset intact.

### The at-rest protection is weaker than it looks

`encryptDataSaveKey(id, data)` (~2294) stores the ciphertext **and its key in the
same record**:

```js
const keys = await makeKeys();              // AES-GCM 256, extractable: false
const encrypted = await encrypt(data, keys);
store.put({ id, keys, encrypted });         // key and ciphertext, same row
```

`loadKeyDecryptData(id)` reads the row and decrypts with the key it just read.
No user verification, no passkey, no prompt. `extractable: false` means script
cannot export the raw key bytes and the browser binds it to the profile — so a
bare copy of the `.ldb` files is not immediately enough — but any code running
in that origin (the app itself, a compromised dependency, anything with the
profile) simply decrypts.

### Two records, and which one you get depends on the authenticator

| Record | Holds | Extra protection |
|---|---|---|
| `id=2` | identity + device keysets | Inner AES-GCM whose key is `SHA-256(master private key)`. Real protection — and see "the PRF path self-heals" below. |
| `id=1` | **the master private key, hex** | **None beyond the co-located key above.** |

### The PRF path self-heals; only the fallback path is the bug

On a PRF-capable authenticator the master private key is NOT in `KeyDB` at all.
It lives in `localStorage['${prefix}-master']` as AES-GCM ciphertext (~2511),
and the decryption key is the **passkey's PRF output** (~2623:
`credential.getClientExtensionResults().prf.results.first`), which is never
written to disk — it exists only inside the authenticator and is released after
user verification.

The consequence for THIS bug: the reset's `localStorage.clear()` destroys that
ciphertext, so the master key becomes unrecoverable, so the surviving `KeyDB`
`id=2` record (encrypted under `SHA-256(master key)`) becomes permanently
undecryptable. For PRF users the reset is effectively honest even though it
leaves the database behind — the residue is inert.

**So the bug is specifically the `id=1` / fallback path**: Electron always, plus
browsers whose authenticator supports neither PRF nor largeBlob. There the key
is in `KeyDB`, which the reset never touches, rather than in `localStorage`,
which it clears.

`id=1` is written by `completeRegistration` (~2428) when the
`${prefix}-master-prf-incompatibility` localStorage flag is set:

```js
await encryptDataSaveKey(1, Buffer.from(request.largeBlob, 'utf-8'));
```

…and `largeBlob` is the master private key (~5978):

```js
await completeRegistration(fqAppPrefix, {
  credentialId,
  largeBlob: buffer.Buffer.from(p.private_key).toString('hex'),
  ...
});
```

### Electron always takes the `id=1` path

This is the part that turns an edge case into the default for the desktop app
(~5769):

```js
if (window.electron) {
  if (!localStorage.getItem(`${prefix}-master-prf-incompatibility`)) {
    localStorage.setItem(`${prefix}-master-prf-incompatibility`, 'true');
  }
  setPasskeySupported(false);
}
```

So **every Electron install stores the raw master private key in `KeyDB` id=1**,
decryptable with no passkey, and a reset never removes it.

(Note: the reset DOES clear `localStorage`, removing the incompatibility flag,
so the app stops *reading* `id=1` afterwards. Deleting the pointer is not
deleting the data — and in Electron the flag is re-set on next launch anyway.)

## Where each platform actually stands

| Platform / path | Master key at rest | Reset clears it |
|---|---|---|
| Mobile | OS keystore (`SecureStore`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — app-sandboxed, excluded from backups/sync) | Yes |
| Browser, PRF authenticator | Ciphertext in `localStorage`; key only inside the authenticator | Yes, in effect (residue goes inert) |
| Browser, fallback authenticator | `KeyDB` id=1, key in the same record | **No** |
| Electron (always this path) | `KeyDB` id=1, key in the same record | **No** |

## Mobile is not affected — verified

`clearAllSecureStorage()` (`services/onboarding/secureStorage.ts:549`) deletes
the master private key, public key, every device key via `clearDeviceKeys()`
(X448 identity pub/priv, prekey, inbox encryption pub/priv, inbox signing
pub/priv, inbox address), the mnemonic, all Farcaster keys, onboarding state and
the wallet, and drops the in-memory cache first. `clearAllMMKVStorage()`
(`services/offline/storage.ts:59`) clears every MMKV store including config
(space keys) and the message DB. Nothing was found surviving. Mobile's reset
does what its copy says.

## Impact

1. **The consent copy is false for Electron and fallback-browser users.** Someone
   resetting specifically to purge key material from a machine they are about to
   sell, return, lend, or hand over still has the master private key on disk,
   recoverable with no passkey, no biometric and no prompt. (PRF-browser users
   are fine in practice — see above.)
2. **It weakens the deregister-before-wipe fix** (desktop #281): that fix stops
   the hub entry and signing admission being orphaned, but the local key that
   could re-announce them is still present.
3. **Not a remote attack.** Exploiting it requires local access to the profile
   or code execution in the app origin. It is a data-remanence and
   false-assurance problem, not a network one.

## The fix, and the decision it forces

Mechanically small: delete `KeyDB` alongside `quorum_db`, **after** the
deregister step (which signs with the master key), matching the existing
blocked-delete handling.

**But it is not a free change, and this is the part to decide deliberately:**

- **On Electron, `KeyDB` id=1 is the ONLY copy of the master private key.** The
  fallback path exists precisely because the authenticator will not hold it.
  So today, an accidental reset is *silently recoverable*: re-register → the
  Electron branch re-sets the incompatibility flag → `authenticate` calls
  `loadKeyDecryptData(1)` → the original master key comes back → same account.
- Deleting `KeyDB` **removes that safety net** and makes reset genuinely
  irreversible for exactly the users who have no other copy. That is what the
  copy already promises and what a "reset" should mean — but it converts a
  recoverable mistake into permanent account loss.
- **This is not an accidental-reset problem.** The action is already gated behind
  typing "reset" and pressing a danger button, which rules out fat-fingering it.
  The gate confirms the user meant to reset; it does not confirm they know what
  resetting now costs.
- **It is a behaviour change under unchanged wording.** Today an Electron user
  resets, re-onboards, and lands back in the same account — the ghost-device
  accumulation this bug came from is direct evidence that a single account
  survives many reset cycles. After the fix, the identical action behind the
  identical dialog stops being survivable. The dialog's export line currently
  reads as prudent advice ("make sure you have exported…"), not as "this is your
  only copy".
- **So ship a copy change with it, not a heavier gate.** Say what now happens:
  this device holds the only copy of your key, and without an export you will
  not get back into this account. A stronger gate (button disabled until an
  export has happened this session) is a judgement call, not a prerequisite.

### Implementation steps

1. **Update the dialog copy in the same change.** The existing type-"reset" gate
   already establishes intent; what it does not do is tell the user the action
   has become unrecoverable. Replace the soft "make sure you have exported your
   private key" with the actual consequence. Small string change, but it should
   land with the delete rather than after it, since that is the moment the
   meaning of the button changes.
2. **Delete `KeyDB` in `handleResetAppData`**, after the deregister step (it
   signs with the master key) and alongside the existing `quorum_db` delete.
   Mirror the existing blocked-delete handling — a blocked delete must surface,
   not half-complete silently, exactly as `quorum_db` already does.
3. **Prefer an SDK call over deleting the database by name.** `KeyDB` belongs to
   `@quilibrium/quilibrium-js-sdk-channels`; reaching into it from app code
   couples us to an internal that can change without notice. Ask the lead for
   something like `passkey.clearStoredKeys()` and use it if offered — same
   "propose, don't self-merge" posture as the other SDK item in the
   ghost-accumulation task. Deleting by name is the fallback, not the goal.
4. **Coordinate with app-lock / duress-wipe**
   ([2026-06-22 report](../reports/2026-06-22-app-lock-password-gate-research.md)):
   a duress wipe wants exactly this behaviour, and Option B's "destroy the DEK"
   would make the erase cryptographically sound rather than best-effort. Don't
   design the two separately.

### Acceptance

- On an Electron build: complete onboarding, reset, then inspect `KeyDB` — no
  record remains, and re-launching cannot restore the old account. This is also
  the regression test the fix needs, and it is what would upgrade this report
  from "confirmed by reading" to "demonstrated".
- A reset blocked by another tab reports the failure rather than partially
  wiping.
- The deregister-before-wipe behaviour from #281 still works (the key must
  survive long enough to sign the deregistration).

## The underlying design is a separate bug

Deleting on reset only removes the *residue*. It does not change the fact that
in normal operation the Electron app stores the master private key with its
decryption key in the same record, unlocked, with no user secret involved.
That is the root cause and it is tracked separately in
[2026-07-31-electron-master-key-at-rest-no-user-secret.md](2026-07-31-electron-master-key-at-rest-no-user-secret.md).
Fixing that one may reduce this one's severity, but it does not replace it: a
reset should still erase the key.

## Confidence

- **Verified in source**: the `quorum_db`-only delete; `KeyDB` never deleted
  anywhere in `src/`; `encryptDataSaveKey` storing key beside ciphertext;
  `makeKeys` non-extractable; `id=1` holding `largeBlob` = master private key
  hex; the unconditional Electron flag; the PRF path keeping the master key as
  `localStorage` ciphertext under an authenticator-held key (so its residue goes
  inert on reset); mobile's `SecureStore` options and clear paths.
- **Corrected after first draft**: the initial version implied PRF-browser users
  also keep recoverable key material after a reset. They do not — clearing
  `localStorage` destroys the only copy of the master-key ciphertext, which
  renders the surviving `id=2` record undecryptable. Narrowing this matters:
  the fix's urgency is about Electron, not "all desktop".
- **Not runtime-tested**: nobody has reset an Electron build and then read the
  key back out of `KeyDB`. That is the check that would move this from
  "confirmed by reading" to "demonstrated". It is also the natural regression
  test for the fix.
- **Unknown**: what share of web users hit the `id=1` path. Electron is always
  `id=1`; browser users depend on their authenticator.

*Last updated: 2026-07-31*
