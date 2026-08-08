---
type: task
title: "Make allowSync a per-device setting, so turning sync off actually stays off"
status: open
complexity: low
priority: high
ai_generated: true
created: 2026-08-08
updated: 2026-08-08
area: config sync / privacy / multi-device
repos: quorum-desktop + quorum-mobile
parent: ".agents/issues/.open/2026-08-07-config-sync-overhaul-design.md"
related:
  - ".agents/issues/.done/2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md"
---

# Make `allowSync` a per-device setting

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Code claims are **READ** at the cited lines on 2026-08-08.

**Slice 2 of [the config sync overhaul](2026-08-07-config-sync-overhaul-design.md).**
Fully unblocked. Small. Best done soon after the timestamp-authority fix
(#320/#243), which touched the same paths.

## What & Why

`allowSync` describes **this device's** relationship to the server, but it is
stored in the account-level synced blob. So a decision made on one device is
carried to the others, and a device that turned sync off can be turned back on
without anyone asking it.

Two ways that happens today, both **READ**:

1. **Local storage is lost.** With no stored config, the timestamp check at
   [`ConfigService.ts:71`](../../../src/services/ConfigService.ts#L71) compares
   the remote against `?? 0`, so the remote always wins, and it is adopted
   verbatim at [`:417`](../../../src/services/ConfigService.ts#L417) with
   `allowSync: true` included.
2. **Another device is still syncing.** Turning sync off is never published (that
   is the whole point of the switch), so the other device never learns, keeps
   publishing, and its blob eventually wins on timestamp. This device adopts it,
   `allowSync` included, and starts publishing again.

Desired: **the local value is authoritative, always.** A device never inherits
this setting from anywhere.

## Semantics, already decided

**Off means "do not publish". It does not mean "do not pull".**

The pull stays ungated, exactly as today (`getConfig` fetches unconditionally at
[`:60`](../../../src/services/ConfigService.ts#L60)). Publishing writes a durable,
decryptable archive; pulling is one GET to a server the client is already in
constant conversation with for messages, Spaces, inboxes and hub registration.
The marginal exposure is close to zero, and keeping it on is what lets a device
recover without opting into publishing.

**A fresh install starts at the local default (`false`), not at whatever the blob
says.** Once the value is device-local there is no inheritance question left to
answer.

## Implementation

Keep publishing the field for backward compatibility with clients that have not
shipped this — just stop *trusting* it on receipt. It is optional-typed, so an
older client reading a blob is unaffected either way.

**The fix is the same shape on both clients**, because neither has an inbound
allow-list: both spread the decrypted remote config wholesale and then re-override
specific fields.

**This is a slice where a gap is genuinely confusing, so keep it short.**
Patching one side half-fixes the symptom in a way that is harder to explain than
the original bug: turn sync off on the patched client and it stays off, do the
same on the unpatched one and it silently comes back, because the patched client
keeps publishing `allowSync: true` in the blob it sends. Not worse than today,
but confusing in a new way. The fix is a handful of lines on each side, so there
is little to gain from splitting it — prefer one release unless something else
forces the order.

### Desktop — `src/services/ConfigService.ts`

At the adopt site (`:417`), preserve the local value rather than taking the
remote's:

```ts
await this.messageDB.saveUserConfig({
  ...config,
  timestamp: savedConfig.timestamp,
  // Device-local: never inherited from the blob. See this issue.
  allowSync: storedConfig?.allowSync ?? false,
});
```

`storedConfig` is already in scope. Apply it to the React Query cache write just
below as well, or the in-memory copy disagrees with the DB until the next reload.

### Mobile — `services/config/configService.ts`

Same change at the `...decryptedConfig` spread (`:519`), in the
`configWithTimestamp` object that already re-overrides ~10 fields. Add
`allowSync` to that list, sourced from `getLocalUserConfig(address)?.allowSync ?? false`.

> ⚠️ Re-read the local value at that point rather than reusing the earlier
> `localConfig` snapshot. The signature verification above it yields the event
> loop, so a settings toggle can land in that window — the same reasoning the
> file already applies to `mergedConversationSettings` at `:510-513`.

### Also check

`useSyncSettings` (mobile, `hooks/useUserConfig.ts:189-195`) reads
`config?.allowSync ?? false` from the same local config, so it needs no change.
Confirm no other read path resolves `allowSync` from a remote object.

## Verification

- [ ] **Two devices, both on.** Turn sync off on A. Use B (change a setting so it
      publishes). Restart A. **A is still off**, and has adopted B's other
      changes. Both halves matter: off is preserved *and* the pull still works.
- [ ] **Fresh install.** Wipe local storage on A with a blob on the server that
      says `allowSync: true`. A comes back with sync **off**, and still restores
      profile, Spaces and settings from the blob.
- [ ] **Revert the change and confirm both go red.** Especially the first: it
      passes trivially if B never actually published during the run, so confirm
      B's publish happened before trusting a green.
- [ ] Turning sync on still works and still publishes.
- [ ] Cross-client: run the first test with A desktop / B mobile, and reversed.
- [ ] An older client still reads a blob published by a patched client without
      change in behaviour.

## Definition of Done

- [ ] Desktop preserves the local `allowSync` on adopt, in DB and cache
- [ ] Mobile preserves it, re-reading the local value at the adopt site
- [ ] Both verification runs pass, and both go red on revert
- [ ] Cross-client run done in both directions
- [ ] **Both clients done** — prefer one release here; a long gap is confusing

---

*Last updated: 2026-08-08*
