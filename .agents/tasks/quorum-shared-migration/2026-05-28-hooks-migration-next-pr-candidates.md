---
type: task
title: Hooks migration — verify candidates and ship one small PR
status: ready
created: 2026-05-28
audience: next session picking up after the hooks audit refresh
---

# Hooks migration — next PR candidates

> **What this is.** A focused, narrow-scope task for the next session. Picks up after the [2026-05-28 hooks audit refresh](designs/2026-05-28-hooks-audit-refresh.md) and the withdrawn A2-query-helpers recommendation. The deliverable for the next session is **one small migration PR**, plus a verification step that justifies the choice.
>
> **Read before starting.**
> - [`2026-05-28-cross-repo-workflow.md`](2026-05-28-cross-repo-workflow.md) — workflow rules (small PRs, additive vs. breaking, "follow mobile patterns", "don't decide for the lead").
> - [`designs/2026-05-28-hooks-audit-refresh.md`](designs/2026-05-28-hooks-audit-refresh.md) — the audit. Skip directly to the "The smallest safe first migration PR" section (it has a withdrawn-recommendation block that explains why A2 is OUT of scope).
>
> **What this is NOT.**
> - Not the audit. Don't try to re-do the audit from this doc.
> - Not the abstraction-layer work (`StorageContext` on desktop, crypto DI). Those are PR-sets 3+ in the audit's roadmap. Out of scope here.
> - Not for Category B hooks. Those depend on the abstraction layer.

---

## Goal

Ship ONE small, additive migration PR (or "shared PR + desktop PR" pair) that:

1. Moves genuinely shareable code from `quorum-desktop` to `@quilibrium/quorum-shared`.
2. Is verified to be useful to mobile (mobile either already has its own duplicate to delete, OR can plausibly adopt the migrated code per the lead-dev's existing patterns).
3. Doesn't depend on any abstraction-layer work that isn't already done.
4. Doesn't require a mobile PR with runtime testing (per the workflow doc's "mobile testing constraint").

If verification turns up that NONE of the candidates below pass, the deliverable is a one-page report explaining why and what the next investigation should be. That's a valid outcome.

---

## Candidates (ranked smallest/safest first)

The verification questions are the work. Don't migrate anything until the verification for that candidate passes.

### Candidate 1 — `useConfirmation` (ui/)

**File**: `src/hooks/ui/useConfirmation.ts` (single file, ~50 LOC per the audit).

**What it is**: a pure two-step state machine for "click confirm, then click again within 5 seconds to commit." No React Query, no contexts, no storage, no platform APIs. Used by `useRoleManagement` and `useUserKicking`, possibly others.

**Verification questions** (answer ALL before migrating):

1. **Does mobile have its own `useConfirmation` hook?** Grep:
   ```bash
   cd D:/GitHub/Quilibrium/quorum-mobile
   git grep -lE "useConfirmation|confirmationStep" origin/master -- "hooks/**" "components/**"
   ```
   - If yes, read it. Is the shape the same as desktop's? If yes → candidate is good; the migration's value is "delete mobile's copy, both use shared."
   - If no, but `useUserKicking.ts` (mobile) has the confirmation state machine inlined → the migration value is "extract that state machine into a shared hook and use it from both sides."
   - If no AND mobile doesn't have a similar pattern anywhere → candidate is weaker; mobile might not want it yet.

2. **What's the actual surface?** Read `src/hooks/ui/useConfirmation.ts` (desktop) end-to-end. Note: any params, any return shape, any internal `setTimeout` that needs to be cancelled on unmount. If it imports anything outside `react`, that import has to be available on shared too.

3. **Does the audit's claim hold?** The side-by-side comparison said `useUserKicking`'s confirmation state machine is "line-for-line identical between desktop and mobile." Quote both sides directly. If they're not actually identical (different timeout, different state names, different reset behavior), the migration needs to pick one and the other side rewrites — that's still doable but it's a bigger story than the comparison implied.

**If verification passes**:
- Migrate `useConfirmation` to `@quilibrium/quorum-shared`, e.g. at `src/hooks/useConfirmation.ts`.
- Update shared's `src/hooks/index.ts` barrel to export it.
- In desktop, replace `src/hooks/ui/useConfirmation.ts` with a one-line re-export shim, OR update consumers to import directly from `@quilibrium/quorum-shared`. (Re-export pattern was used for utils — matches existing convention.)
- Mobile PR (only if mobile has its own duplicate to delete): bump shared dep, delete mobile's copy, point consumers at shared. Per the workflow doc's "mobile testing constraint" — verify this is statically verifiable only (grep confirms zero importers of mobile's old version after the change). If anything runtime-touches, defer the mobile PR.

**Sizing estimate**: 1 file moved, 1 barrel update, 1 re-export shim. Desktop side: <30 LOC diff. Shared side: <100 LOC. Mobile side: variable depending on whether mobile has a copy.

---

### Candidate 2 — Validation hooks (6 files)

**Files**: `src/hooks/business/validation/`:
- `useChannelValidation.ts`
- `useDisplayNameValidation.ts`
- `useGroupNameValidation.ts`
- `useMessageValidation.ts`
- `useProfileValidation.ts`
- `useSpaceNameValidation.ts`

Plus possibly `useDeviceNameValidation.ts` (new since March, per the audit).

**What they are**: pure functions over strings. Return `{ isValid, error, validate(value) }` or similar. Each enforces a set of rules (length, allowed characters, uniqueness) for one user-facing identifier.

**Verification questions**:

1. **Does mobile validate the same fields?** Grep:
   ```bash
   cd D:/GitHub/Quilibrium/quorum-mobile
   git grep -lE "channelName|displayName|spaceName|groupName" origin/master -- "hooks/**" "components/**"
   ```
   Find mobile's form components or hooks that handle these fields. Does mobile validate the same rules, or different rules, or no validation at all?

2. **One concrete example to look at**: `useChannelValidation` is exercised in `hooks/chat/useChannelManagement.ts` (mobile)? The audit said mobile splits channel CRUD into multiple hooks — does any of them validate input?

3. **Do the validation rules diverge?** If desktop says "channel names must be 1–24 chars" and mobile (somewhere) says "1–32 chars", that's a real product question for the lead, not a migration. Document the divergence rather than picking one.

4. **What dependencies do the desktop hooks have?** Some validation hooks import `@lingui/core/macro` for translated error messages. Per the audit, shared's i18n story is unresolved — Decision 5 in the old March doc. Three options:
   - Migrate the hooks WITHOUT translated error strings (return `{ isValid, errorKey }` and let the platform translate)
   - Migrate WITH lingui (requires shared to take a lingui peer dep)
   - Keep on desktop until i18n is sorted

**If verification passes** (mobile has parallel validation, rules match, i18n story is solvable):
- Migrate as ONE PR (all 6 hooks at once if rules match) OR one hook at a time if rules diverge per field.
- Standard re-export shim pattern in desktop.
- Mobile PR: only if mobile has its own validation to delete.

**Sizing**: 6 files. ~200–400 LOC total. Bigger than Candidate 1 but still small.

**Risk note**: the i18n question is the dealbreaker. If the validation hooks can't be migrated cleanly without dragging lingui into shared, defer this candidate.

---

### Candidate 3 — Extract `useKickConfirmation` from `useUserKicking`

**Files**: `src/hooks/business/user/useUserKicking.ts` (desktop) + `hooks/chat/useUserKicking.ts` (mobile, on `origin/master`).

**What it is**: NEW hook to be created in shared, extracting just the confirmation state machine (the part the audit said is line-for-line identical between desktop and mobile). The actual kick dispatch stays per-platform.

**Verification questions**:

1. **Re-read both files end-to-end.** The audit's subagent claimed "line-for-line identical confirmation state machine." Verify directly by quoting both sides. If they're not actually identical, the extraction is bigger than it seemed.

2. **What does the extracted shape look like?** Probably something like:
   ```ts
   export function useKickConfirmation(): {
     confirmationStep: 0 | 1;
     kicking: boolean;
     handleKickClick: (kickFn: () => Promise<void>) => Promise<void>;
     resetConfirmation: () => void;
   };
   ```
   The platform-specific `kickFn` is passed in, not owned by the hook. This makes the hook reusable for any "two-click confirm before destructive action" flow, not just kicking.

3. **Should it be `useKickConfirmation` or a generic `useTwoStepConfirm`?** If multiple places use this pattern (kick, leave space, delete channel, delete message), the generic name is better. Audit briefly: how many `confirmationStep` / `requiresConfirmation` patterns exist on each side? Grep both repos.

4. **Does this overlap with Candidate 1 (`useConfirmation`)?** They might be the same primitive. If yes, do Candidate 1 first; this becomes a follow-up that just uses the shared `useConfirmation`.

**If verification passes**:
- Add the new hook to shared (`src/hooks/useKickConfirmation.ts` or `useTwoStepConfirm.ts`).
- Refactor desktop's `useUserKicking` to use the new shared hook for the confirmation state machine, keeping the kick dispatch logic.
- Refactor mobile's `useUserKicking` similarly. This IS a mobile runtime-touching PR — see the workflow doc's mobile-testing constraint. Probably means: defer this candidate unless mobile testing is actually planned.

**Sizing**: small in lines, medium in risk because it touches runtime code on both platforms. Probably NOT the first PR — it's better as Candidate 4 or later, after Candidate 1 has proven the migration plumbing.

---

### Candidate 4 — `forceUpdate` (utils/)

**File**: `src/hooks/utils/forceUpdate.ts` — a 5-line `useReducer((x) => x + 1, 0)` style helper.

**What it is**: trivial pure utility. The toe-in-the-water candidate.

**Verification questions**:

1. **Does mobile use this pattern?** Grep mobile for any `useReducer` `+1` patterns, or any `forceUpdate` exports. Likely no — this is a desktop-specific React idiom.

2. **What's the migration value if mobile doesn't use it?** Probably none. If mobile won't import it, it's not really shared.

**Recommendation**: skip unless verification surprises us. Pure-import != shareable. Same trap as A2.

---

### Candidate 5 (out-of-scope mention) — Desktop queryKey unification

**Not a migration to shared. A pure desktop refactor.**

Desktop has hand-rolled cache keys: `buildSpacesKey() = ['Spaces']`. Shared exports `queryKeys.spaces.all = ['spaces']`. Same logical key, different cache slot. If someone wires desktop to use shared's `queryKeys` and the casing differs, cache invalidation breaks subtly.

This is a real cleanup opportunity, but it's not part of the shared migration. Mentioned here only so a future session doesn't accidentally re-suggest it as a migration target.

If pursued, it's a standalone desktop PR: replace all `buildXxxKey({})` calls with `queryKeys.xxx.*`, rename desktop's `buildSpacesKey` → align with shared's lowercase. Self-merge. Risk: desktop's cache invalidation has to be tested manually after.

---

## Suggested order

1. **Start with Candidate 1 (`useConfirmation`).** Smallest, cleanest, most likely to verify quickly.
2. **If Candidate 1 passes verification AND the migration ships cleanly**, consider Candidate 2 (validation hooks) — bigger but same shape.
3. **Defer Candidate 3** (`useKickConfirmation` extraction) until at least Candidate 1 has shipped. It's bigger than it looks because it touches runtime on both platforms.
4. **Skip Candidate 4** (`forceUpdate`) unless verification shows mobile uses it.
5. **Don't touch Candidate 5** as part of this task — it's a separate desktop refactor.

---

## Verification gates for any migration

Standard from the existing workflow. Run all four before declaring the PR ready:

- `yarn test` in `quorum-shared`
- `yarn test:run` + `npx tsc --noEmit --jsx react-jsx --skipLibCheck` in `quorum-desktop`
- `yarn build` in both
- Manual smoke test of one consumer in the desktop UI

For any mobile PR (if mobile has a duplicate to delete):
- `npx tsc` in `quorum-mobile`
- Grep confirms zero consumers of the deleted file
- NO mobile app runtime test (we don't run mobile per the workflow rule)

---

## Pre-flight checks (every session start, every time)

```bash
cd D:/GitHub/Quilibrium/quorum-mobile && git fetch && git log -1 --format="%h %ad %s" --date=short origin/master
cd D:/GitHub/Quilibrium/quorum-shared && git pull
cd D:/GitHub/Quilibrium/quorum-desktop && yarn install
```

**Mobile's working tree is stuck on a Jan 14 commit.** All `git grep` / `git log` on mobile MUST target `origin/master` explicitly (`git show origin/master:<path>`, `git grep <pattern> origin/master -- <paths>`). The local working tree is NOT current.

---

## When this task is done

The deliverable is ONE of:

- **A merged shared PR + desktop PR pair** for the migrated candidate. Optionally a mobile PR if mobile had a duplicate.
- **OR a short report** (one section in this file, or a new dated `.agents/reports/` doc) explaining why no candidate passed verification and what the next investigation should be.

Either outcome is success. Picking the wrong PR is failure.

Update the migration master tracker ([README.md](README.md) status table) when done.

---

*Created 2026-05-28 — focused next-session task after the hooks audit refresh withdrew the A2-query-helpers recommendation. Designed to keep continuous context across sessions by being narrow, verifiable, and self-contained.*
