---
type: bug
title: "The copy-key success message promises an auto-clear that clipboard managers and cloud clipboard defeat"
status: done
priority: low
created: 2026-08-12
updated: 2026-08-12
area: settings / key export / clipboard
platforms: quorum-desktop — Electron primarily, web secondarily
related:
  - .agents/issues/.secret/local-data-protection/2026-08-12-key-material-exposure-audit.md (found here, as F8)
  - .agents/issues/port-from-mobile/.done/2026-06-11-port-key-paste-import-and-copy-export.md (the risk was known when the feature was built)
---

# The auto-clear message is stated as a guarantee it cannot give

## What the app says

After copying the account private key, Electron users see
([`Security.tsx:558-560`](../../../src/components/modals/UserSettingsModal/Security.tsx)):

> Private key copied. It will be cleared from your clipboard automatically in 60
> seconds.

Web users see the honest version, because the web path cannot promise anything:

> Private key copied. Store it securely and clear your clipboard when you're
> done.

## Why the Electron wording is wrong

**The clearing itself works.** [`main.cjs:59-89`](../../../web/electron/main.cjs)
does a proper compare-and-clear at 60s, plus a clear on `before-quit`, and it
only wipes the clipboard if the value is still the one we wrote. That is a good
implementation and this issue is not asking to change it.

The problem is that clearing the system clipboard does not reach the copies
other software has already taken:

- **Windows Clipboard History** (`Win+V`) keeps entries, and **Cloud Clipboard**
  syncs them to the user's Microsoft account across machines.
- **macOS Universal Clipboard** hands the value to nearby Apple devices.
- **Third-party clipboard managers** (Ditto, Maccy, CopyQ, Flycut, Paste) snapshot
  every copy by design and are extremely common among the technical users most
  likely to be exporting a key in the first place.

None of these is reachable from the app. So the sentence describes an action the
app really does take, while implying an outcome — "the key is no longer
anywhere" — that is frequently false. The web wording, which asks the user to do
something, is the safer shape precisely because it does not imply the problem is
handled.

**This was known when the feature was built.** It is written down in
[`2026-06-11-port-key-paste-import-and-copy-export.md:86`](../port-from-mobile/.done/2026-06-11-port-key-paste-import-and-copy-export.md)
("readable by other processes / clipboard managers / Windows Cloud Clipboard").
It just never reached any user-facing string — a repo-wide search for "clipboard
manager", "cloud clipboard" or "clipboard history" finds no hit in `src/` or
`web/`.

## Severity

Low, and it is a **copy** bug rather than a security defect. Nothing behaves
incorrectly; the user is given more confidence than the situation supports, and
so may skip clearing their clipboard history when they otherwise would have.

## Suggested fix

Keep the auto-clear. Adjust the Electron message so it states what was done
without implying completeness, and points at the part the user has to handle.
Something in the shape of:

> Private key copied. Quorum will clear it from your clipboard in 60 seconds.
> Clipboard history tools keep their own copy, so clear those too.

Worth writing the same caveat into the pre-copy warning callout
(`Security.tsx:536`), which currently says "clear your clipboard afterwards"
without saying that the clipboard is not the only place it went.

## Status

**2026-08-12 — shipped in PR #336** (`fix(settings): confirm every Account Key
action the same way`).

What landed: both the copy-success callout and the pre-copy warning now state
that clipboard history and sync tools keep their own copy, which Quorum cannot
clear, so the user knows to clear those too. The Electron auto-clear message no
longer reads as "the key is no longer anywhere".

Filed 2026-08-12 out of the key-material egress audit, where it is F8.

*Last updated: 2026-08-12*
