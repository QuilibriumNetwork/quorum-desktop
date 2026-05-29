---
type: design
title: "SearchService re-audit: stays per-app (one micro-shareable)"
status: done
created: 2026-05-29
audience: future sessions reviewing the migration tracker's SearchService row
related_docs:
  - .agents/tasks/quorum-shared-migration/designs/2026-05-18-services-design.md
  - .agents/tasks/quorum-shared-migration/designs/2026-05-28-actionqueue-reaudit.md
---

# SearchService re-audit (2026-05-29)

> **Verdict: stays per-app.** Desktop's `SearchService` is a thin caching/debouncing wrapper over `MessageDB` (IndexedDB-backed persistent index). Mobile's `useMessageSearch` is a self-contained hook over an in-memory `DisplayMessage[]` rebuilt per session. Same library, same MiniSearch config — fundamentally different storage and lifecycle. **One micro-shareable**: the MiniSearch options constant (`fuzzy: 0.2, prefix: true, boost: content 2x`) could live in shared as a 3-line export for cross-platform consistency. Not session-worth on its own; do opportunistically. Update status table row from `⏸️ Re-evaluate` to `❌ Stays per-app`.

## Why this re-audit exists

The [2026-05-18 services design doc](2026-05-18-services-design.md) §3 classified `SearchService` as **Tier 1B**: technically portable, with one caveat (`NodeJS.Timeout` should be `ReturnType<typeof setTimeout>`), but migration direction unclear until mobile's search architecture was inspected. This re-audit fills that gap against mobile `origin/master 98d59a4`.

## Desktop side: still Tier 1B as the May audit said

`SearchService.ts` (304 lines) confirmed unchanged in shape since the May audit:

- **Constructor**: `(messageDB: MessageDB, config?: Partial<SearchServiceConfig>)` — one injected dep
- **Role**: caching + debouncing proxy over `MessageDB`'s full-text search. All actual indexing lives in `MessageDB`.
- **Value-add**: 5-min TTL LRU cache, `searchWithDebounce()` timer management, `getSuggestions()`, `highlightSearchTerms()` (returns HTML with `<mark>` tags), cache invalidation by `SearchContext`.

Platform coupling — verified line-by-line:

| Item | Status |
|---|---|
| `NodeJS.Timeout` (line 26) | ⚠️ Type-only — fix to `ReturnType<typeof setTimeout>` |
| `setTimeout` / `clearTimeout` | ✅ Universal |
| IndexedDB / `localStorage` | ✅ None in service; all through injected `MessageDB` |
| React Query / React hooks | ✅ None in service file |
| DOM APIs (`document`, `window`, `navigator`) | ✅ None in service. The DOM `visibilitychange` listener is in `useSearchService.ts` (the hook), not the service. |
| `@lingui/core/macro` | ✅ None |
| Crypto / encryption | ✅ None — service receives pre-decrypted `SearchResult` |
| `highlightSearchTerms()` returns HTML | ⚠️ Design choice — see below |

**Two new observations the May audit didn't surface:**

1. **`initialize()` is now a documented no-op stub** (lines 44-46). Simplification, not a complication — the service no longer needs an init protocol.
2. **`highlightSearchTerms()` returns HTML strings** with `<mark>` tags. Not a runtime DOM call, but it's the only method with a rendering opinion. On mobile (React Native) this output is unusable — RN doesn't render HTML. If migrated, either the method moves to a desktop-only utility, or it takes a `wrapMatch?: (match: string) => string` callback.
3. **No tests exist** for `SearchService` in desktop (unlike `ReceiptService`/`TypingService`). A migration would need tests written from scratch.

The May verdict ("technically portable, migration direction unclear") was correct. Today's question is what mobile actually does.

## Mobile side: hook + in-memory MiniSearch (different architecture)

`hooks/chat/useMessageSearch.ts` is a React hook, not a service class. Self-contained — owns the MiniSearch index lifecycle, query state, and open/closed toggle in a single function.

### Key surface

```ts
export function useMessageSearch(messages: DisplayMessage[]): {
  query: string;
  setQuery: (s: string) => void;
  results: SearchResult[];           // { message, matchIndex, score }
  resultCount: number;
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}
```

### Lifecycle

- **No persistent index.** Index is rebuilt from the `messages` array on first open (lazy, deferred via `InteractionManager.runAfterInteractions`).
- **No remote endpoint.** Pure local search over already-decrypted `DisplayMessage[]` (decryption happens upstream in `useMessages`).
- **No TanStack Query.** Plain `useState` + `useMemo` + `useEffect`.
- **Scope**: one channel/DM at a time. Instantiated once per `SpaceChatArea` and once per `DMChatArea`.

### MiniSearch configuration — IDENTICAL to desktop

```ts
{ fuzzy: 0.2, prefix: true, boost: { content: 2 } }
```

Both repos use MiniSearch (`^7.1.2` mobile, `^7.2.0` desktop). The actual search options are byte-identical. The DIFFERENCE is what feeds the index and where it lives.

### Field difference (worth noting)

| Repo | Indexed fields |
|---|---|
| Desktop | `content`, `senderId` (hex address — no human would type it) |
| Mobile | `content`, `userName` (display name — searchable as UX) |

Desktop resolves user info separately at display time (`useBatchSearchResultsDisplay`). Mobile bakes it into the index. If shared, this needs reconciliation.

## Side-by-side comparison

| Capability | Desktop `SearchService` | Mobile `useMessageSearch` |
|---|---|---|
| Architecture | Class + injected MessageDB | Self-contained hook |
| Index source | IndexedDB-persisted MiniSearch | In-memory rebuild from `DisplayMessage[]` |
| Persistence | Yes — across sessions | None — per-session only |
| LRU eviction | Yes — 5-min TTL on cache | N/A |
| Debouncing | Yes — `searchWithDebounce()` | None |
| MiniSearch config | `fuzzy 0.2, prefix true, boost content 2` | **Identical** |
| Indexed fields | `content`, `senderId` | `content`, `userName` |
| Highlighting | HTML `<mark>` snippets | `matchIndex: number` (offset) |
| Suggestions | Yes — `getSuggestions()` | None |
| Cross-channel / cross-space search | Yes — `useGlobalSearch` + `SearchContext` | None |
| Cross-DM search | Yes | None |
| ~20 supporting hooks (highlighting, virtualization, keyboard nav, focus, batched display) | Yes | None — RN `TextInput` + `FlashList` handle these natively |

## Verdict

**Stays per-app.** Three reasons in priority order:

1. **Different storage models.** Desktop's `SearchService` only makes sense paired with `MessageDB`'s persistent IndexedDB. Mobile rebuilds from in-memory data each session. Sharing the service class would force mobile to either (a) build a persistent index it doesn't need, or (b) the shared class becomes a no-op wrapper that does nothing useful on mobile.

2. **Different scopes.** Desktop's search architecture (the ~20 hooks in `business/search/`) is built around cross-space global search with batched data resolution, virtual scrolling, keyboard navigation, and suggestion lists. Mobile has none of these — one hook, one channel, no global surface. Migrating the service codifies an abstraction mobile has explicitly chosen not to build.

3. **The genuinely shared piece is tiny.** The MiniSearch options (`fuzzy: 0.2, prefix: true, boost: { content: 2 }`) are 3 lines. Worth standardizing in shared as a constant so future tuning stays in sync — but not a migration, just a 5-minute cross-platform consistency PR done opportunistically.

## What could be shared (the micro-shareable)

Single 3-line export in shared:

```ts
// In quorum-shared (e.g. src/utils/search.ts)
export const QUORUM_SEARCH_INDEX_OPTIONS = {
  fuzzy: 0.2,
  prefix: true,
  boost: { content: 2 } as const,
} as const;
```

Both repos already use these exact values. Sharing the constant guarantees they stay in sync if tuning is needed. Desktop currently hardcodes them in `MessageDB`; mobile hardcodes them in `useMessageSearch`. Either could import from shared.

**Recommendation: don't open this as a standalone PR right now.** Bundle opportunistically — if a future migration touches search anyway, fold this in. Not session-worth on its own.

## Action items

### Status table update

Change [README.md](../README.md) row from:

> | SearchService + SearchAdapter | Service | ⏸️ Re-evaluate after mobile public-repo dump (2026-05-28) | designs/2026-05-18-services-design.md §3 |

To:

> | SearchService + SearchAdapter | Service | ❌ Stays per-app. Re-audited 2026-05-29: same MiniSearch config across platforms, but desktop persists index in IndexedDB while mobile rebuilds in-memory per session. One micro-shareable (MiniSearch options constant) for opportunistic future bundling. | designs/2026-05-29-searchservice-reaudit.md |

### Mobile-side observation (not actionable from here)

Mobile has **no global search and no persistent index**. If a user searches in channel A then switches to channel B, the index rebuilds. If they search across spaces, they can't — mobile doesn't expose it. These are mobile product decisions, not shared-migration concerns. Worth flagging only because someone reading desktop's ~20 search hooks might think mobile has equivalents — it doesn't.

### Out-of-scope cleanup we noticed

- **Desktop**: `SearchService.extractTextFromMessage()` duplicates logic in `useSearchResultHighlight.ts` (both independently re-implement `message.content.type === 'post'` branching). Dead weight in the service. Not a migration concern; a future desktop cleanup.

## What this means for the migration plan

- **No follow-up task file.** Documented why we're not migrating.
- **No shipped-log entry.** Re-audits aren't shipped migrations.
- **The micro-shareable lives in this doc as a footnote.** If a future session bundles a search-related migration, they can fold it in.

## Method (for transparency)

Two parallel subagents on `origin/master` for both repos, with explicit instructions to read mobile files via `git show origin/master:<path>` (local mobile working tree stuck on Jan 14). Reports synthesized into this doc. Key claims verified by direct grep and code reads — not inferred.

---

*Created 2026-05-29. Resolves the "⏸️ Re-evaluate" status on the SearchService row. Verdict: stays per-app. Pattern matches the [ActionQueueService re-audit](2026-05-28-actionqueue-reaudit.md) outcome — different storage models, different scopes.*
