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
  - ".agents/issues/.done/2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md"
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

> ⚠️ **Both numbers in this section are superseded — see §6.** The 873 KB was a
> stale snapshot, the real figure was 4205 KB, and that blob **uploaded
> successfully**. The "one bookmark from the cliff" framing below is wrong in
> both directions and is kept only because how it was wrong is the useful part.

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

## §6. MEASURED 2026-08-05 (same account, later the same day) — a 4205 KB blob UPLOADED FINE

Taken after the bookmark-avatar strip landed and forced a fresh `saveConfig`,
with `.agents/tools/dm-debug/08-self-identity-sources.js`. Three findings, and
each one changes something in this issue.

### 6-A. The ceiling is at least 4x higher than recorded. §4.4 has its first real data point.

| | |
|---|---|
| blob | **4205 KB** |
| `allowSync` | on |
| refuse-to-publish hold | not holding |
| outcome | **upload succeeded** |

The outcome is inferred, but the mechanism is tight: `ConfigService.saveConfig`
POSTs at `:695` and calls `saveUserConfig` at `:711` **with no try/catch between
them**, and `QuorumApiClient` throws on any 4xx. So a rejected upload skips the
local save. The local config was observably rewritten (its bookmark copy went
from 619.8 KB to 0.0 KB in that same save), therefore the POST returned.

**So `~1 MB observed working` should be read as `~4.2 MB observed working`.**

🔴 **But do not read that as headroom — it is the opposite.** Cross-referencing
`2025-12-09-encryption-state-evals-bloat.md` §Problem, the original reported
failure was *"the total payload exceeded the server limit (**~4MB**)"*, a 400
`invalid config missing data`. So the two known points are now:

| | payload | outcome |
|---|---|---|
| this measurement, 2026-08-05 | **4205 KB (4.11 MB)** | ✅ accepted |
| original report, 2025-12-09 | "~4 MB" | ❌ 400 rejected |

Those effectively touch. The real limit is a hair above 4205 KB, or the original
"~4MB" was itself an estimate — either way **this account is sitting ON the
threshold, not four times under it.** One more created space (~2 MB) puts it
over, and per §2 nothing would say so. The earlier "one large bookmark away from
the cliff" in §3 had the wrong number but, by accident, the right posture.

### 6-A-bis. MEASURED 2026-08-07 on a physical Android device — 4566 KB accepted, and a NEW failure mode

Captured incidentally via `adb logcat` while verifying
[the timestamp-authority fix](../.done/2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md)
on a real phone. Not a contrived test — this is ordinary use.

```
14:35:32  W [ConfigSync] settings POST FAILED — this device is NOT publishing config: Request timeout
14:36:01  I [ConfigSync] published ts=1786106119904 bytes=4566434 conversationSettings=3
14:36:05  I [ConfigSync] server read-back CONFIRMS ts=1786106119904
```

**Two findings, and the first breaks the bracket above.**

**1. 4566 KB (4.35 MB) was accepted, with a server read-back confirming it
landed.** That is *higher* than the "~4 MB" figure recorded as a 400 rejection on
2025-12-09. Both cannot be a simple byte ceiling. So either the 2025-12-09
number was an estimate rather than a measurement, or **the limit is not a byte
threshold at all** and the rejection was caused by something correlated with size
rather than size itself. The updated picture:

| | payload | outcome |
|---|---|---|
| 2026-08-07, physical device | **4566 KB (4.35 MB)** | ✅ accepted, read-back confirmed |
| 2026-08-05 | 4205 KB (4.11 MB) | ✅ accepted |
| 2025-12-09 | "~4 MB" | ❌ 400 rejected |

This makes §4's question to the lead dev sharper, not softer: we now have a
confirmed acceptance **above** the only recorded rejection, so "what is the
limit" cannot be answered by bisecting these numbers. Ask what the server
actually validates.

**2. A client-side `Request timeout` is a second failure mode, distinct from the
400.** The 4.35 MB upload exceeded the client's `DEFAULT_TIMEOUT` before the
server ever answered. It is louder than the 400 (it does reach `logger.warn`),
but it lands in the same catch and is equally invisible in the UI. Any size guard
should treat "too slow to upload on a phone connection" as a failure case in its
own right, because a payload can be under the server's ceiling and still never
arrive over mobile data.

**User-visible consequence, observed:** the operator reported the sync toggle
"does nothing" when tapped. It was not broken — the switch was disabled for
~13 seconds while the 4.35 MB POST was in flight, then the POST timed out and it
silently retried. A settings toggle with no progress indication and a
multi-second, failure-prone operation behind it reads as a broken control. This
is P4 (indistinguishable outcomes) meeting P1 (unbounded payload) in
[the overhaul design](2026-08-07-config-sync-overhaul-design.md), and it argues
for §5.4's outcome reporting being surfaced next to the toggle rather than only
in a log.

> Note: the timestamp fix means the timed-out POST no longer poisons this
> device's clock — the next pull adopted normally instead of going deaf. Before
> that fix, this single ordinary timeout would have permanently stopped this
> phone applying any other device's config.

The ~21 MB figure remains a separate, much higher observation and should be
treated as unreliable until reconciled — a 4 MB rejection and a 21 MB rejection
cannot both be the limit. §4.4 still needs the real number, and this is now the
sharpest bracket available for asking: **it is between 4.11 MB and whatever the
2025-12-09 account actually sent.**

### 6-B. Why §3's number was wrong, and why that generalises

`config.spaceKeys`, `config.bookmarks` and every other blob field are a
**snapshot written by the last `saveConfig`**, not a live view. The account read
873 KB one hour and 4205 KB the next with no user action in between beyond a
settings toggle; nothing grew, the stale copy simply caught up.

> **Any blob measurement taken without forcing a fresh save is a LOWER BOUND.**

This is not a footnote — it is why the bloat has been characterised for eight
months as "space creation occasionally 400s" rather than "the payload is
permanently multi-megabyte". Nobody was ever looking at a current number. Any
size guard built for §4.1 must measure the payload it is **about to send**, not
`sizeOf(storedConfig)`, or it will read the previous save's size and pass.

### 6-C. A size guard alone will not close this. THREE states are indistinguishable today.

This issue frames the problem as "no size check". The deeper problem is that a
device cannot tell whether its config reached the server **at all**, for any
reason:

| state | what the user sees | what the local DB shows |
|---|---|---|
| `allowSync` off | settings save fine | config row updated |
| refuse-to-publish hold | settings save fine | config row updated |
| genuine upload | settings save fine | config row updated |

`saveConfig` writes the local row in all three, so **"my setting saved" has never
been evidence of sync** — and a size-rejection would become a fourth
indistinguishable member of that set. Add to §4:

5. **Report the publish OUTCOME, not just the size.** Whether the last save was
   uploaded, held, skipped for `allowSync`, or rejected — and when. A stored
   `lastPublishedAt` / `lastPublishOutcome` would make every one of these
   answerable from the UI instead of from a console script.

The diagnostic now prints all three states plus the size verdict, so this is
answerable today for anyone who runs it. That is an instrument, not a fix.

### 6-D. Adds to §5: a second stale claim in the same doc

`config-sync-system.md` also stated *"the 100KB per-encryption-state filter keeps
total payload well under limits."* **No such filter exists.**
`ConfigService.ts:561` filters on `encryptionState !== undefined` — a presence
check, not a size check — and a codebase-wide search for a 100 KB constant finds
only the image compressor's threshold and two IndexedDB row limits. Corrected in
that doc 2026-08-05.

That sentence is plausibly why this issue took until 2026-08-05 to be written:
the doc asserted a mitigation that was never built, so the budget looked
supervised.

### 6-E. What the 4205 KB actually was

98% encryption states, and now attributable per space (the tool read `.name`
instead of `spaceName` until 2026-08-05, so every space rendered as "(unknown)"
and no earlier reading could name them):

| space | KB | |
|---|---|---|
| Cross device test | 1976.1 | created |
| Test Leave | 1975.4 | created |
| three joined spaces | 34-63 each | joined |

Two throwaway test spaces, 94% of the payload. Detail and the fix options are in
`.agents/issues/.open/2025-12-09-encryption-state-evals-bloat.md`. Bookmarks —
the thing that triggered all of this — are now 37.1 KB, under 1%.

---

*Last updated: 2026-08-05*
