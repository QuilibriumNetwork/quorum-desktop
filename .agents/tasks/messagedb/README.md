---
type: index
title: "MessageDB Refactor — Master Tracker"
status: ongoing
created: 2026-05-19
updated: '2026-05-20'
---

# MessageDB Refactor — Master Tracker

> **Sibling workstreams in flight (2026-05-19):** [quorum-shared migration](../quorum-shared-migration/README.md) and [test suite review](../2026-05-19-test-suite-review.md). The receipts PR in the shared migration is coupled to Tier 0 #3 here (see [shared-migration-cross-check.md](./shared-migration-cross-check.md)).

> **What this folder is.** Single source of truth for the ongoing decomposition of the originally-5,650-line `MessageDB.tsx` and the services extracted from it. The refactor runs opportunistically rather than as a single tracked epic. This README is the bird's-eye view.

## Folder map

```
messagedb/
├── README.md                              ← this file (master tracker + action plan)
├── current-state.md                       ← dashboard: line counts, services, status
├── messageservice-deep-dive.md            ← per-method breakdown of the 5,465-line file
├── optimizations-low-risk.md              ← cross-cutting cleanups (type safety, naming, hygiene)
├── optimizations-high-risk.md             ← kickUser, createSpace, joinInviteLink breakdowns
├── handleNewMessage-reconsidered.md       ← fresh design for per-message-type extraction
│                                            (supersedes the Dec 2025 archived plan)
└── shared-migration-cross-check.md        ← verification that the master plan doesn't conflict
                                            with the quorum-shared migration
```

Convention: each file owns one role. The README contains the **plan ordering**; the file owns the **plan content**.

## Status snapshot (May 2026)

- **MessageDB.tsx**: 1,458 lines (was 5,650 — 74% reduction)
- **MessageService.ts**: 5,465 lines, +136% since Oct 2025 extraction — keeps growing with features
- **14 service-layer files**: ~12,940 lines total
- **Most recent extractions**: ThreadService (607 lines, May 2026), TypingService (300 lines, May 2026), ReceiptService (204 lines, Mar 2026), SearchService (290 lines, Mar 2026)

See [current-state.md](./current-state.md) for the full table.

## Master action plan (safest to riskiest)

Each item lists the doc that owns its content, the risk, the rough time investment, and what the value is.

### Tier 0 — Safe housekeeping (do whenever)

| # | Task | Doc | Risk | Time | Value |
|---|------|------|------|------|-------|
| 1 | Rename `processDeliveryReceiptData` → `interceptControlMessages` | [low-risk §4.1](./optimizations-low-risk.md#41-rename-processdeliveryreceiptdata--interceptcontrolmessages) | ⚠️ Low | 15 min | Method now also dispatches typing — name lies |
| 2 | Remove `React.MutableRefObject` from services (12 spots, 5 services) | [low-risk §2.2](./optimizations-low-risk.md#22-remove-react-types-from-services) | ⚠️ Low | 30 min–1 h | Hygiene; modest expansion of shared-migration surface |
| 3 | ~~Normalize control-message intercept shape~~ ✅ DONE (2026-05-20) | [low-risk §4.3](./optimizations-low-risk.md#43-normalize-control-message-intercept-shape) | — | — | Landed as cleanup commit on the receipts-shared-migration branch (PR #147). Dead `raw.content?.type` fallbacks removed; receiver now reads only the flat wire shape. |
| 4 | Type piggybacked ack fields | [low-risk §4.4](./optimizations-low-risk.md#44-type-the-piggybacked-ack-fields) | ⚠️ Low | 30 min | Removes 4 `(message as any)` casts. **Unblocked** — receipts shared migration landed in PR #147 (2026-05-20). |

**Order rationale**: #1, #2, #4 are < 1 hour each, near-zero risk, no behavior change. Stack them in any short session. #3 is done. #4 was previously gated on the receipts shared migration; that migration shipped 2026-05-20, so #4 is now ready.

### Tier 1 — Larger but still low-risk (when you have a focused day)

| # | Task | Doc | Risk | Time | Value |
|---|------|------|------|------|-------|
| 5 | Replace `any` types (97 occurrences across 5 services) | [low-risk §2.1](./optimizations-low-risk.md#21-replace-any-types) | ⚠️ Low (per service) | **1–2 days** | Compile-time bug catching; desktop hygiene. (All 5 affected services are per-app — see [cross-check](./shared-migration-cross-check.md#issue-a-overstating-shared-migration-enablement).) |
| 6 | NotificationService singleton → DI'd class | [low-risk §4.2](./optimizations-low-risk.md#42-convert-notificationservice-singleton-to-a-normal-class) | ⚠️ Low–Med | Half-day | Testability; consistency (only service in the folder that isn't DI'd) |
| 7 | `BaseService` extraction (common deps) | [low-risk §3.1](./optimizations-low-risk.md) | ⚠️ Low | 1 h | -50 lines per service; **must follow #5** so base class uses real types. (Cross-check confirms no migration-eligible service fits the BaseService shape, so no shared-migration risk — see [cross-check](./shared-migration-cross-check.md#issue-c-overstated-baseservice-risk-to-shared-migration).) |

**Order rationale**: #5 first (it's the precondition for #7 to be done well, and unlocks IDE confidence for everything downstream). #6 is independent — slot wherever convenient. #7 last in this tier.

### Tier 2 — Per-message-type extractions (opportunistic, follow ThreadService precedent)

These follow the ThreadService extraction pattern. Each one is its own PR with its own unit tests. Do when working in that feature area. See [handleNewMessage-reconsidered.md](./handleNewMessage-reconsidered.md) for the full rationale.

| # | Task | Doc | Risk | Time | Value |
|---|------|------|------|------|-------|
| 8 | Extract `MessageCacheService` (~800 lines, pure React Query) | [deep-dive Priority 1](./messageservice-deep-dive.md#priority-1-messagecacheservice-800-lines) | ⚠️ Low | 2–3 days | Largest single chunk; React Query is testable in isolation |
| 9 | Extract `ReactionService` (~250 lines) | [reconsidered](./handleNewMessage-reconsidered.md#suggested-first-extraction) | ⚠️ Low–Med | ~2 days | Self-contained; first proof that the post-ThreadService pattern generalizes |
| 10 | Extract `ProfileService` (~150 lines for `update-profile`) | [reconsidered](./handleNewMessage-reconsidered.md) | ⚠️ Med | ~2 days | Touches participant + inbox_address rotation — see "Open questions" in reconsidered |
| 11 | Extract `EditService` (~400 lines: `edit-message`, `remove-message`, `pin`) | [reconsidered](./handleNewMessage-reconsidered.md) | ⚠️ Med | ~3 days | Larger scope, but the three message types share permission-checking patterns |

**Order rationale**: #8 is genuinely independent and has the highest line/value ratio. Then per-message-type starting smallest (#9) to prove the pattern outside ThreadService before bigger ones (#10, #11). Each tier-2 task is opportunistic — do it when feature work brings you into that file anyway.

### Tier 3 — High-risk function breakdowns (only when feature work demands it)

These are documented separately in [optimizations-high-risk.md](./optimizations-high-risk.md). Quoted verdicts:

> "These are **opportunistic refactorings** — do them when you're already working in that area."

| # | Task | Doc | Risk | Time | When |
|---|------|------|------|------|------|
| 12 | Break down `kickUser` (443 lines) | [high-risk Task 1](./optimizations-high-risk.md#-task-1-break-down-kickuser-443-lines) | ⚠️⚠️ High | 3–4 h | Adding moderation features or fixing kick bugs |
| 13 | Break down `createSpace` (352 lines) | [high-risk Task 2](./optimizations-high-risk.md#-task-2-break-down-createspace-352-lines) | ⚠️⚠️ High | 3–4 h | Adding space creation features |
| 14 | Break down `joinInviteLink` (343 lines) | [high-risk Task 3](./optimizations-high-risk.md#-task-3-break-down-joininvitelink-343-lines) | ⚠️⚠️ High | 3–4 h | Changing invite flow |

**Order rationale**: no fixed order. Trigger is feature work, not the refactor itself.

### Explicitly NOT recommended

- **Crypto separation into a standalone `CryptoService`** — high risk of security regression, see [optimizations-high-risk.md Task 4](./optimizations-high-risk.md#-task-4-separate-crypto-operations-very-high-risk).

## Cross-cutting context

**Relationship to the quorum-shared migration**: largely orthogonal. Most of the work in this folder produces desktop-only improvements. Verification of the full plan against the shared-architecture rules and the [services-design audit](../quorum-shared-migration/designs/2026-05-18-services-design.md) is documented in [shared-migration-cross-check.md](./shared-migration-cross-check.md). Headline findings:

- **One sequencing constraint** — Tier 0 #3 (intercept normalization) must land before or with the receipts shared migration so the wire format doesn't get locked with an ambiguity in it.
- **No tier item conflicts** with the per-service classifications in the services-design audit.
- **Two pieces of doc framing** were corrected during the cross-check: the type-safety pass (#2, #5) is desktop hygiene, not a "shared migration enabler"; the BaseService extraction (#7) carries no actual shared-migration risk because no migration-eligible service fits its dependency shape.

See also [current-state.md §Cross-cutting context](./current-state.md#cross-cutting-context-relationship-to-quorum-shared-migration) and the corresponding section in the [shared-migration README](../quorum-shared-migration/README.md#relationship-to-the-messagedb-refactor).

## Active state

- **In progress**: branch `refactor/messageservice-rename-and-typing` — stacking Tier 0 #1, #4, #2 (started 2026-05-20).
- **Most recent**: receipts shared migration (PR #147, 2026-05-20) — incidentally landed Tier 0 #3 as a precursor cleanup. ThreadService extraction (April–May 2026), TypingService extraction (May 2026), audit refresh + folder reorg (2026-05-19).
- **Blockers**: none for any Tier 0/1 item. Tier 2 items unblock once someone has a focused day. Tier 3 waits on feature triggers.

---

_Last updated: 2026-05-20 — Tier 0 #3 marked ✅ done (landed inside receipts-shared-migration PR #147); Tier 0 #4 unblocked. Branch `refactor/messageservice-rename-and-typing` opened to stack #1 + #4 + #2._

_Previously 2026-05-19 — folder reorganized. Files renamed: `messagedb-current-state.md` → `current-state.md`, `messageservice-analysis.md` → `messageservice-deep-dive.md`, `messagedb-optimization-1.md` → `optimizations-low-risk.md`, `messagedb-optimization-3.md` → `optimizations-high-risk.md`. New files: `handleNewMessage-reconsidered.md`, `shared-migration-cross-check.md`. This README is new and owns the safest-to-riskiest master action plan. Tier 0 #3 marked with the sequencing constraint surfaced by the cross-check; framing softened for #5 and #7._
