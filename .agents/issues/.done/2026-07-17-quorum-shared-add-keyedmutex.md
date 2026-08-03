---
type: task
title: "quorum-shared: add KeyedMutex util (per-key FIFO async lock) + desktop import swap"
status: DONE 2026-07-17 — shared PR #59 (KeyedMutex) + #60 (bump to 2.1.0-35) merged; desktop swapped to the shared export in PR #237. Remaining: npm publish of 2.1.0-35+ so mobile can consume (tracked in the mobile task).
created: 2026-07-17
related:
  - ".agents/docs/dm-ratchet-upstream-divergences.md (justification doc for the lead dev)"
  - "quorum-mobile/.agents/tasks/2026-07-17-serialize-dm-ratchet-state-keyedmutex.md (consumer task)"
---

# quorum-shared: add KeyedMutex

## Why shared

`src/utils/keyedMutex.ts` (desktop) is ~40 lines of pure TypeScript, zero dependencies:
a per-key FIFO async lock used to serialize Double Ratchet state operations per conversation
(the fix for the 6-month DM delivery bug). Mobile has NO lock utility in its crypto services
and needs the same serialization (its receipts also ride the DM ratchet). One canonical
implementation in shared prevents drift and gives mobile a ready-made primitive.

## Steps

1. **Branch in quorum-shared** (NEVER edit on main — user opens the PR, lead dev merges).
2. Copy `KeyedMutex` from desktop `src/utils/keyedMutex.ts` into shared's utils, additive
   only. Keep the class generic (no DM-specific naming in shared; the `dmRatchetMutex`
   singleton stays app-side — each app creates its own instance).
3. Port the 6 unit tests from desktop `src/dev/tests/utils/keyedMutex.unit.test.ts`.
4. Export from the barrel. Follow shared's `X.Y.Z-N` versioning convention (lead-dev
   convention — do not "fix" it to plain SemVer).
5. After publish: desktop follow-up PR — replace the local `../utils/keyedMutex` import in
   `MessageService.ts` with the shared import, delete the local file + local test.
6. Mobile consumes it per its own task (see related).

## Constraints

- Additive-only, no type changes that could break mobile (mobile is pinned to published
  versions).
- Desktop must keep working from the LOCAL copy until the shared version is published —
  do not block the DM fix on the shared release cycle.

---
*Created: 2026-07-17 — Last updated: 2026-07-17*
