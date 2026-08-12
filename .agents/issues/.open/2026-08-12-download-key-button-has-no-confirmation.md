---
type: bug
title: "\"Download file\" writes the account private key to disk with no confirmation, unlike its two sibling buttons"
status: open
priority: low
created: 2026-08-12
updated: 2026-08-12
area: settings / key export
platforms: quorum-desktop — web and Electron
related:
  - .agents/issues/.secret/local-data-protection/2026-08-12-key-material-exposure-audit.md (found here, as F4)
---

# "Download file" has no confirmation

## What happens

In **Settings → Security → Account Key** there are three buttons in one row:

| Button | Gate |
|---|---|
| Download file | **none — one click writes the key to disk** |
| Copy key | two-step confirm, red warning callout |
| Show QR | two-step confirm, red warning callout |

[`Security.tsx:493-501`](../../../src/components/modals/UserSettingsModal/Security.tsx)
wires the first button straight to `onClick={downloadKey}`. The other two go
through `handleCopyKeyClick` / `handleShowQRClick`, which render a warning and
require a second, explicitly-worded click ("I Understand, Copy").

`downloadKey` ([`useUserSettings.ts:240-257`](../../../src/hooks/business/user/useUserSettings.ts))
then calls the SDK's `exportKey()` and writes the result to a `Blob` download
with no further prompt.

## Why it is worth fixing

Not because the download is wrong — key export is a deliberate, load-bearing
feature and account recovery depends on it. Three smaller things stack up:

1. **It is the least-guarded path to the most valuable secret in the app**, and
   it sits between two buttons that are guarded. Whatever reasoning justified the
   confirmations on Copy and Show QR applies at least as strongly here: the file
   persists, where a clipboard entry and a QR code both expire.
2. **The file is plaintext and self-identifying.** The filename is
   `<account address>.key`, so anyone who later finds it knows exactly which
   account it opens. Nothing about the file says what it is or that it should be
   moved somewhere safe.
3. **It lands in the browser's download location**, which on a large share of
   machines is inside a cloud-synced folder. The key is then wherever that
   provider keeps it, and in that provider's version history.

**Severity is low** — an attacker needs local access to the unlocked app, and at
that point they can click through a confirmation too. This is about protecting
the user from a misclick, not about stopping an attacker.

## Suggested fix

Route the button through the same `useConfirmation` pattern already used a few
lines below for backup export
([`Security.tsx:207-223`](../../../src/components/modals/UserSettingsModal/Security.tsx)),
or the inline callout pattern the Copy button uses. The wording should say what
the file is, that it is not encrypted, and that Downloads is usually synced.

Worth checking at the same time whether the file should carry a `.txt`-style
header line explaining what it is, so it is not an anonymous blob a year later.

## Out of scope

The onboarding "Download Key Backup" step
([`BackupKeyStep.tsx:25`](../../../src/components/onboarding/steps/BackupKeyStep.tsx))
calls the same function and is **fine as-is** — the entire step is the
confirmation, with the explanation already on screen. Do not add a second prompt
there.

## Status

Filed 2026-08-12 out of the key-material egress audit, where it is F4. Confirmed
by reading the source; not urgent, and explicitly deprioritised at filing time.

*Last updated: 2026-08-12*
