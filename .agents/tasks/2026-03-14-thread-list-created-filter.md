---
type: task
title: "Thread List Panel: 'Created by me' filter"
status: backlog
priority: low
created: 2026-03-14
---

# Thread List Panel: "Created by me" Filter

## Goal

Add an occasional-use filter to the ThreadsListPanel that lets users quickly find threads they created, for management purposes (settings, close, delete).

## Design Decisions Made

- **Use case**: Quick access to threads the user owns, for management/moderation (not a new persistent category)
- **Frequency**: Occasional — a toggle/filter is sufficient, not an always-visible section
- **No duplication**: Must NOT create a separate "Created Threads" category alongside "Joined Threads" — every created thread already has `hasParticipated: true`, so a new category would duplicate entries
- **UI approach**: TBD — panel space is tight. Options explored:
  - Filter/tab row below search ("All" | "Created by me")
  - Dropdown/chip filter next to search input
  - Simple toggle in header area
  - Needs further design exploration for space constraints

## Implementation Notes

### Current categorization logic ([ThreadsListPanel.tsx](src/components/thread/ThreadsListPanel.tsx))

Three groups based on `hasParticipated` and `lastActivityAt`:
1. **Joined Threads** — `hasParticipated === true`
2. **Other Active Threads** — not joined, activity within 7 days
3. **Older Threads** — not joined, inactive 7+ days

### Data already available

- `ChannelThread.createdBy` — user address of thread creator (already stored in IndexedDB `channel_threads` store)
- Current user address available via auth context
- Filter is purely client-side: `threads.filter(t => t.createdBy === currentUserAddress)`
- No DB schema changes, no new indexes, no network changes needed

### Key files to modify

| File | Change |
|------|--------|
| `src/components/thread/ThreadsListPanel.tsx` | Add filter state + UI toggle, filter `listItems` by `createdBy` |
| `src/components/thread/ThreadsListPanel.scss` | Styles for filter UI element |

### Minimal approach

1. Add a boolean state `showCreatedOnly` to ThreadsListPanel
2. When active, filter threads to `t.createdBy === currentUserAddress` before categorization
3. When no created threads exist in the channel, hide the filter entirely
4. Keep existing category grouping (Joined/Active/Older) within the filtered results

---

_Created: 2026-03-14_
