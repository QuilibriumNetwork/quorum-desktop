---
type: tracker
title: Mobile tasks pending (dropped during desktop migration sessions)
status: ongoing
created: 2026-05-28
audience: future sessions wanting to see what's queued on the mobile side
---

# Mobile tasks pending

> Mobile's `.agents/` is gitignored, so mobile task files have no GitHub visibility. This table is the desktop-side bookkeeping: a list of mobile tasks dropped during our migration sessions, so we don't lose track of work that's been handed off.
>
> **Maintenance**: when a mobile task file moves to `.done/` (or is closed), update the row here. Append new rows at the BOTTOM (chronological by drop date).

## Currently queued

| Drop date | Task file | What it covers | Triggered by (desktop PR) | Runtime test? | Status |
|---|---|---|---|---|---|
| 2026-05-28 | [`2026-05-28-adopt-shared-validators.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md) | Drop mobile's local `validateSpaceName` + inline length constants in `SpaceModal.tsx` and `SpaceSettingsModal.tsx`; consume `@quilibrium/quorum-shared@2.1.0-19` validators via a thin English-string translator. Adds XSS check on space name (defense-in-depth). | [quorum-desktop#162](https://github.com/QuilibriumNetwork/quorum-desktop/pull/162) (validation hooks migration) | ✅ required | 📋 open |

## Completed

(empty)

---

*Created 2026-05-28. Workflow rationale in [2026-05-28-cross-repo-workflow.md](2026-05-28-cross-repo-workflow.md) section "Proactive mobile task drop".*
