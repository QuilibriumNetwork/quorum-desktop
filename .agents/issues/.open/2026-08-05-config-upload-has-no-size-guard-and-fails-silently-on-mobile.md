---
type: bug
title: "The config upload has no size guard, and on a mobile release build its failure is invisible"
status: open
priority: high
created: 2026-08-05
updated: 2026-08-05
severity: a device that crosses the size limit stops syncing EVERY setting, permanently, with no signal to the user or to us
area: config sync / payload size / observability
repos: quorum-desktop + quorum-mobile
source: found by independent review during the 2026-08-04 stale-display-name investigation
related:
  - ".agents/issues/.open/2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md"
  - ".agents/issues/.open/2026-07-31-spaces-list-cross-device-sync.md"
  - ".agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md"
  - ".agents/docs/config-sync-system.md"
---

# The config upload has no size guard, and mobile's failure is invisible

## §1. The two halves

**No client measures the payload before sending it.** Desktop's
`ConfigService.saveConfig` and mobile's `saveConfig` both build the ciphertext and
POST it with no byte-length check of any kind. The only guard either has is the
spaceIds/spaceKeys consistency hold, which is unrelated to size.

**And on mobile, the failure is compiled out.** Mobile's `saveConfig` catches a
failed POST and reports it with `logger.warn`, which is a **no-op in release
builds** (`2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`). The
mobile source carries a comment warning about exactly this black hole; the
mechanism written to prevent it does not run in the build users have.

## §2. Why this is worse than a size bug

The config blob is the **only** cross-device transport for the Spaces list,
notification settings, mutes, device names, per-conversation DM settings, user
notes and the global profile. Its failure mode is the quiet kind: the device keeps
working, the UI looks right, the value saves locally, and nothing ever leaves.

So the observable symptom of "your blob got too big" is **"cross-device sync
mysteriously stopped working on one device"** — with no error, no log in release,
and no way to tell it from any of the other sync bugs already open. Anyone
debugging that lands in the wrong place.

## §3. It is not hypothetical

MEASURED 2026-08-05 on a real 5-space account
(`2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md`
§4-A-vi): the blob is **873 KB** against a **~1 MB observed working ceiling**.
That account is one large bookmark away from the cliff, and nothing would tell
them they had gone over.

## §4. What to build

1. **Measure before POSTing**, on both clients. The ciphertext length is already
   in hand at the call site.
2. **Fail loudly.** A real user-facing signal on the save that crossed the line,
   not a log. On mobile it must not be `logger.*` until that bug is fixed.
3. **Warn on approach**, not only on failure — a threshold below the ceiling, so
   the problem surfaces while it is still fixable.
4. Establish the **actual** server limit. `config-sync-system.md` records ~1 MB as
   *observed working* and ~21 MB as an *observed failure*, which is a wide
   unknown. The real number should be measured or asked for, not inferred.

## §5. A doc correction found alongside

`config-sync-system.md` states the **server** validates that `spaceIds` and
`spaceKeys` are consistent and returns `400 - invalid config missing data`. The
server receives only ciphertext (`ConfigService.saveConfig` posts `user_address`,
`user_public_key`, the encrypted `user_config`, `timestamp`, `signature`) and
therefore cannot inspect either field. That claim is stale, or describes a
client-side guard. Correct it when this is fixed.

---

*Last updated: 2026-08-05*
