---
type: bug
title: "Thread title not updating in UI after pressing Enter"
status: done
priority: high
ai_generated: true
created: 2026-03-11
updated: 2026-03-11
---

# Thread title not updating in UI after pressing Enter

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

After clicking the thread title to edit and typing a new title, pressing Enter
closed the input but the title in the header reverted to the original text.
The save appeared to do nothing visible.

## Root Cause

`rootMessage` in `ThreadPanel` is sourced from `activeThreadRootMessage`, a React
state variable set **once** when the thread opens (`setActiveThreadRootMessage(message)`)
and **never updated** afterward.

The `updateTitle` flow correctly:
1. Saved the new `threadMeta` to IndexedDB via `submitChannelMessage`
2. Updated the main channel message React Query cache
3. Invalidated the `thread-messages` query (so reply list refreshes)

However, `activeThreadRootMessage` was not part of any of these update paths.
Channel.tsx sets `rootMessage: activeThreadRootMessage` into the thread context
on every render, so the stale snapshot always won over the updated data.

The three prior fix attempts (double-save guard, sender auth, idempotency guard)
addressed real issues in the message pipeline but none touched the display path,
which is why the symptom persisted.

## Solution

In `handleUpdateThreadTitle` (`Channel.tsx:550-553`), after `submitChannelMessage`
resolves, optimistically merge the updated `threadMeta` into the local state:

```typescript
setActiveThreadRootMessage((prev) =>
  prev ? { ...prev, threadMeta: { ...prev.threadMeta, ...updatedMeta } } : prev
);
```

This causes the `useEffect` at line 129 to fire with the updated root message,
which propagates it into the thread context and triggers a `ThreadPanel` re-render.

- Fix commit: `cda47d23`

## Prevention

When a feature stores a "snapshot at open time" in local state, any mutation
of that entity must also update the snapshot. The React Query cache and IndexedDB
are not automatically reflected in detached state copies.

If `rootMessage` were derived from the messages query (like `threadMessages`) instead
of being held in separate state, this class of bug would not occur. Consider
deriving `rootMessage` from the main channel messages query in a future refactor.

---

_Updated: 2026-03-11_
