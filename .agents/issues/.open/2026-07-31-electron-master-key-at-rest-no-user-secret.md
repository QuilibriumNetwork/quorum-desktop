---
type: bug
title: "Electron stores the master private key at rest with no user secret — its decryption key sits in the same record"
status: open
priority: high
created: 2026-07-31
severity: HIGH for the downloadable desktop app (the master key is recoverable from disk with no passkey, biometric, or prompt). Not remotely exploitable.
platforms: quorum-desktop — Electron always; browser only on fallback authenticators. quorum-mobile and PRF-capable browsers are unaffected.
related:
  - .agents/issues/.open/2026-07-31-reset-app-data-leaves-private-keys-in-keydb.md (the residue-after-reset symptom of this design)
  - .agents/reports/2026-06-22-app-lock-password-gate-research.md (independently found this in §1 "Electron reality"; Option B is one of the routes below)
  - .agents/issues/.done/2025-12-20-action-queue-plaintext-private-keys.md (earlier at-rest key exposure, different store)
  - .agents/reports/privacy-analysis-quorum-2025-12-03.md ("consider optional at-rest encryption")
---

# Electron keeps the master private key unlocked on disk

## Status

statically confirmed in source and in the shipped SDK bundle; options identified, none chosen. Needs a decision BEFORE the desktop app ships.


> Split out of the reset-residue bug on 2026-07-31: that one is about a reset
> failing to erase the key, this one is about the key's protection during normal
> operation. Fixing this reduces that one's severity but does not replace it.
>
> **Timing is the point.** The desktop app has not shipped. There are zero
> installs to migrate, so whichever route is chosen costs a fraction of what it
> will cost afterwards. The 2026-06-22 report lists migration as a major cost of
> the passphrase route — right now that cost is close to zero.

## The defect

`usePasskeyFlow` in `@quilibrium/quilibrium-js-sdk-channels` forces the
non-passkey fallback whenever it is running in Electron (`dist/index.js` ~5769):

```js
if (window.electron) {
  if (!localStorage.getItem(`${prefix}-master-prf-incompatibility`)) {
    localStorage.setItem(`${prefix}-master-prf-incompatibility`, 'true');
  }
  setPasskeySupported(false);
}
```

That flag routes registration to `encryptDataSaveKey(1, <master private key hex>)`
(~2428), and `encryptDataSaveKey` stores the ciphertext **and the key that
decrypts it in the same IndexedDB record** (~2294):

```js
const keys = await makeKeys();              // AES-GCM 256, extractable: false
const encrypted = await encrypt(data, keys);
store.put({ id, keys, encrypted });         // key and ciphertext, same row
```

`loadKeyDecryptData(1)` reads the row and decrypts with the key it just read. No
passkey, no biometric, no prompt, no user secret of any kind. `extractable:
false` stops script exporting the raw key bytes and the browser binds it to the
profile, so a bare copy of the `.ldb` files is not immediately enough — but any
code running in that origin simply asks the SDK to decrypt, which is a normal
supported operation rather than an exploit.

**Every Electron install is on this path**, unconditionally. A browser only
lands here if its authenticator supports neither PRF nor largeBlob.

### What the strong path does instead

With a PRF-capable authenticator the master key is never in `KeyDB`. It sits in
`localStorage['${prefix}-master']` as AES-GCM ciphertext (~2511) whose key is
the passkey's PRF output (~2623) — a value that is never written to disk and is
released only after user verification. That is the bar Electron should reach.

## Exposure

Local access or local code execution only; nothing here is remote.

- **Infostealer malware running as the user.** The realistic one. This class of
  malware already targets browser profiles and Electron app data (it is how
  Discord/Slack token theft works). No admin rights needed, no crypto to break,
  and the passkey is not in the loop to stop it.
- **A machine that leaves the user's control** — sold, returned, repaired, lent,
  or "reset" first (see the sibling bug, where reset does not remove it).
- **Backups and sync** covering the app data directory.
- **A compromised dependency or update** inside the app bundle.

Consequence if obtained: the master key *is* the account. Impersonation,
signing, registering new devices, reading what is sent to them. There is no
rotation or password reset for it.

## Routes to a fix (none chosen — this is what to research)

### 1. `safeStorage` (Electron's OS keychain) — cheap floor, no UX cost

DPAPI on Windows, Keychain on macOS, libsecret/kwallet on Linux. Binds the
ciphertext to the OS user account, which closes the entire "file leaves the
machine" class: theft, resale, copied profile, backups.

Does **not** stop malware running as the user, because the OS hands the key to
any process with that identity — precisely how Chrome cookie theft works on
Windows. macOS Keychain ACLs make it somewhat better there than on Windows.

Already recommended in the 2026-06-22 report §4. This is the minimum that should
exist before the app ships; it is not parity with a passkey.

### 2. Passphrase / app lock — real parity in kind

The protecting secret stops living on the machine and starts living in the
user's head. This is the property that makes the browser path strong, and it is
the only route on this list that resists an attacker who already has code
running as the user (until they keylog it or scrape unlocked memory).

Already scoped as **Option B** in the 2026-06-22 report (Argon2id → key that
encrypts the local DB), pending lead sign-off, and it is also what makes the
duress-wipe story cryptographically real. Costs: a lost-passphrase policy (for a
key-based account that means losing the account) and the UX of unlocking.

### 3. Real WebAuthn/PRF inside Electron — literal parity, deletes code

Newly plausible: Electron core added `app.configureWebAuthn({ touchID: {
keychainAccessGroup } })` to enable the macOS Secure Enclave platform
authenticator ([electron/electron#51411](https://github.com/electron/electron/pull/51411)),
and third-party native modules cover Touch ID / Windows Hello / security keys
([@electron-webauthn/native](https://www.npmjs.com/package/@electron-webauthn/native),
[electron-webauthn-mac](https://github.com/vault12/electron-webauthn-mac) — the
latter documents that WebAuthn in Electron on macOS was simply broken before
this). Historically that is why the SDK's Electron branch exists at all.

If this works, it is the cleanest outcome by far: the `window.electron` branch
gets deleted and the existing strong path runs unchanged.

> **The deciding question, and it needs a spike, not an opinion: working
> passkeys are NOT the same as working PRF.** The SDK needs
> `credential.getClientExtensionResults().prf.results.first` as the encryption
> key. Whether Electron's implementation surfaces a PRF result is not something
> the docs settle, and it is exactly the kind of thing that is easy to assume
> and be wrong about. Spike: create a credential in an Electron build with the
> `prf` extension requested and check whether a result comes back on both macOS
> and Windows. That one experiment decides whether route 3 exists.

### Recommended shape (for discussion, not decided)

Run the route-3 spike first, because a positive result removes the problem
instead of mitigating it. Ship route 1 as the floor regardless, since it is
cheap and closes the theft class outright. Treat route 2 as the opt-in upgrade
it is already designed to be, rather than a launch blocker.

## Scope note: this is SDK-side

The offending branch and the storage helpers live in the lead's SDK repo, not
here. Routes 1 and 3 both need SDK changes (or an SDK-provided hook). Propose
via the usual channel; do not self-merge. Route 2 is mostly app-side and is
already in the team's own research.

## The ceiling — worth stating so expectations stay honest

Desktop cannot reach mobile's posture on any of these routes. Mobile's real
protection is OS app sandboxing: another app simply cannot read your keychain
items. No desktop OS does that for ordinary applications, so malware running as
the user remains a live threat even on the strong path. The realistic target for
the desktop app is "as good as browser with a passkey", not "as good as mobile".

## Confidence

- **Verified in source**: the unconditional Electron flag; `id=1` receiving the
  master private key hex; `encryptDataSaveKey` storing the key beside the
  ciphertext; `makeKeys` non-extractable; the PRF path keeping the master key
  under an authenticator-held key instead.
- **Cited, not tested**: Electron's WebAuthn/Touch ID support (links above).
  PRF availability specifically is **unverified** and is the spike named above.
- **Not tested**: no one has extracted the key from a real Electron install.
  That would demonstrate rather than infer the exposure.
- **Unknown**: whether a copied profile decrypts on a *different* machine, which
  depends on how Chromium binds non-extractable `CryptoKey` material. Does not
  change the finding on the original machine, but it does change how bad "stolen
  laptop" is.

*Last updated: 2026-07-31*
