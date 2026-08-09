---
type: bug
title: "An already-armed sync crashes with an unhandled rejection after the user is kicked from a Space"
status: done
priority: medium
ai_generated: true
created: 2026-08-09
updated: 2026-08-09
area: sync / spaces
related:
  - ".agents/issues/.open/2026-08-09-backup-restore-overhaul-design.md"
---

# An armed sync crashes after a kick

> **Found by measurement, not by reading.** The `space-kick` harness scenario
> (added alongside the backup/restore work) kicks a real bot from a real Space
> against the live relay. The kick behaved correctly; vitest then reported an
> unhandled rejection the scenario had not been looking for.

## Status

**Fixed 2026-08-09, shipped in PR #324** (`feat(backup): back up Space keys, and
never let a restore undo a deletion`). The `space-kick` scenario now runs clean
with no unhandled errors, which is the verification this was found by.

## Symptom

```
TypeError: Cannot read properties of undefined (reading 'address')
 ❯ SyncService.initiateSync src/services/SyncService.ts:247
    247|       inboxKey.address!,
```

An **unhandled promise rejection**, not a caught failure — so it escapes to the
process rather than being logged and skipped.

## Root cause

`initiateSync` reads the Space's `inbox` key and immediately dereferences it with
a non-null assertion:

```ts
const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
// ...
inboxKey.address!,
```

Being kicked deletes the Space **and all of its keys** (`MessageService`'s
removed-from-space handler loops `deleteSpaceKey` over every key). A sync armed
*before* the kick then fires *after* it, finds no inbox key, and throws.

The `!` makes this a lie the type system accepts: the value is genuinely optional
at this point in the lifecycle.

This is the same class of problem the code immediately below the kick handler
already guards against, and says so:

> *"The space is gone from under us. Any armed convergence timer would fire ~20s
> from now against a deleted space and broadcast a sync-request into a space we
> were just removed from."* — hence `forgetRosterConvergence(spaceId)`.

The convergence timer was disarmed. `initiateSync` was not.

## Fix

Return early when the key is absent, matching what the method already does a few
lines later when there are no sync candidates: there is nothing to sync into a
Space we are no longer in.

Deliberately a **guard, not a repair** — the correct behaviour when the Space is
gone is to do nothing, quietly. Anything more ambitious would be inventing work
for a Space the user is not in.

## Verification

- [x] `space-kick` scenario runs with **zero unhandled errors** (it reported one
      on every run before the guard).
- [x] Full suite green (1203).
- [ ] Not separately unit-tested. The guard is a null check on a path whose
      trigger is a race between an armed timer and a kick; the harness scenario is
      what exercises it, and it does so incidentally rather than by design.

## Prevention

- **A non-null assertion on anything fetched from the database is a claim about
  lifecycle, not about types.** Space keys are deleted on kick, leave, and
  migration; any `!` on a key lookup is asserting the Space still exists, which is
  exactly what those three events falsify.
- **Unhandled rejections in a test run are findings, not noise.** vitest flagged
  this as "might cause false positive tests" and it would have been easy to read
  past, since the scenario it appeared in was passing.
