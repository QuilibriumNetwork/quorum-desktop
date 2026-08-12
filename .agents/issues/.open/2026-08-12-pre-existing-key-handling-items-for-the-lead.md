---
type: task
title: "Pre-existing key-handling items that need the lead (five findings, one file)"
status: open
priority: low
created: 2026-08-12
updated: 2026-08-12
area: key handling / upstream coordination
platforms: quorum-desktop, plus quorum-shared and quilibrium-js-sdk-channels
related:
  - .agents/issues/.secret/local-data-protection/2026-08-12-key-material-exposure-audit.md (source audit; findings F1, F3, F7b, F9, F10)
---

# Pre-existing key-handling items for the lead

## Why this is one file and not five

These are five separate findings from the key-material egress audit. They are
filed together on purpose: they share an owner, a severity band, and a decision,
and five files would each demand attention none of them individually deserves.

**Every one of them predates this repo's current contributor.** `git blame` puts
all five in `43f3fa4d3` "initial public commit" (2025-01-19) or in the two
first-party packages maintained upstream. None is a regression, none was
introduced by recent work, and none is urgent.

**None of them is a working attack**, which is why this file is public rather
than in `.secret/`. The one finding from the same audit that *is* live —
the identity keyset being reachable from page context — stays in
`.secret/local-data-protection/` and is tracked from that epic's INDEX. Do not
merge that one into this file.

## The five

| | Finding | Where | Severity | What it would take |
|---|---|---|---|---|
| **F1** | `UnsealHubEnvelope` and friends `console.log` the first 8 bytes of the Space config private key and the first 80 characters of every decrypted message. Ungated `console.log`, not the `logger`, so it runs in production. | `quilibrium-js-sdk-channels`, `src/channel/channel.ts:744-775` | Low | Delete 5 lines, or route them through `logger`. Keep the two `WARNING: No config key provided … (legacy)` lines — those signal a real condition. |
| **F3** | `parseInviteParams` logs 30 characters of `configKey`, `secret` and `hubKey`. | `quorum-shared`, `src/utils/inviteDomain.ts:148` | Very low | Drop the value from the log line. Gated by `logger`, which is off in production, so this only affects developer consoles. |
| **F7b** | A joined invite link leaves `#…&configKey=<private key>` in the address bar and in browser history. | `quorum-desktop`, invite processing | Low | One `history.replaceState` after a successful join. |
| **F9** | `UserConfig` carries Space private keys and is spread in ~20 places. Every current use is a local write or the encrypted upload, so nothing is wrong today. | `quorum-desktop`, `UserConfig` shape | Low, but structural | A type split or lint rule so a `spaceKeys`-bearing object cannot reach a network call. This is the one with lasting value — it protects against the next instance rather than this one. |
| **F10** | The config-sync AES key is `SHA-512(private_key)[0:32]` with no domain separation, unlike `BackupService` which prefixes `quorum-backup-v1`. | `quorum-desktop`, `ConfigService.ts:697-711` | Note only | Changing it is a migration. Recorded so nobody reaches for `SHA-512(privkey)` and silently collides with the config key. |

## What is actually being asked

Nothing here needs to ship soon. Two decisions, when convenient:

1. **F1 and F3 go upstream.** Both are in the lead's packages, so propose rather
   than self-merge, per the standing rule for SDK work. F1 is worth mentioning
   promptly only because it ships today and the fix is deleting debug lines — not
   because it is dangerous. Nothing leaves the device; the exposure is a console
   nobody has open, plus screen-shares and "paste your console output" support
   flows.
2. **F9 is the one worth real effort**, and it is in this repo. It is the only
   item here that prevents a future mistake instead of correcting a past one.

F7b and F10 can ride along with any nearby work.

## Status

Filed 2026-08-12 from the key-material egress audit, consolidated into one file
rather than five. Not started. No deadline.

*Last updated: 2026-08-12*
