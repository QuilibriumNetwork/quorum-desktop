# Design: Discord-style Thread Panel Layout with Resize

## Problem

The ThreadPanel currently renders **inside** Channel.tsx's flex container, squeezing the main message area when opened. Discord renders the thread panel as a separate column at the outermost content level, so the main chat doesn't get compressed — the thread panel extends from the right edge as an independent column.

Additionally, users should be able to **resize** the thread panel by dragging its left edge.

## Solution

Move ThreadPanel from Channel.tsx to Space.tsx level, making it a flex sibling of `<Channel />` inside `space-container`. Create a `ThreadContext` for state sharing between Channel (which owns thread logic) and ThreadPanel (which now renders outside Channel).

### Layout: Before vs After

**Before (current):**
```
space-container (flex row)
├── space-container-channels (260px)
└── Channel (flex-1)
    └── internal flex container
        ├── messages + composer (flex-1) ← SHRINKS when thread opens
        ├── ThreadPanel (400px)
        └── users sidebar (260px)
```

**After (Discord-style):**
```
space-container (flex row)
├── space-container-channels (260px)
├── Channel (flex-1) ← unchanged width, includes users sidebar
└── ThreadPanel (resizable, 400px default)
    └── drag handle on left edge
```

## Architecture

### ThreadContext

A lightweight React context that Channel.tsx populates and ThreadPanel consumes. This avoids lifting 40+ props to Space.tsx.

```typescript
interface ThreadContextValue {
  // State
  isOpen: boolean;
  threadId: string | null;
  rootMessage: Message | null;
  threadMessages: Message[];
  isLoading: boolean;

  // Actions
  openThread: (messageId: string) => void;
  closeThread: () => void;
  submitMessage: (message: string | object, inReplyTo?: Message) => void;
  submitSticker: (sticker: any) => void;

  // Channel data (needed by ThreadPanel for MessageList/MessageComposer)
  channelProps: ThreadChannelProps;
}
```

`ThreadProvider` wraps both Channel and ThreadPanel in Space.tsx. Channel calls `useThreadContext()` to set state; ThreadPanel calls it to read state.

### Resize Handle

- Drag handle on the **left edge** of ThreadPanel (4px wide, cursor: col-resize)
- `mousedown` → `mousemove` → `mouseup` pattern
- Width stored in `localStorage` key `thread-panel-width`
- Bounds: min 300px, max 50vw
- Default: 400px
- CSS custom property `--thread-panel-width` on the panel element

### Responsive Behavior

- **Desktop (≥1024px)**: Thread panel renders as flex column alongside Channel
- **Mobile (<1024px)**: Thread panel renders as full-screen overlay or drawer (existing mobile pattern)

## Components Changed

| Component | Change |
|-----------|--------|
| `Space.tsx` | Wrap children in `ThreadProvider`, render `<ThreadPanel />` after `<Channel />` |
| `Channel.tsx` | Remove ThreadPanel JSX, populate ThreadContext instead |
| `ThreadPanel.tsx` | Consume ThreadContext, add resize handle, remove `isOpen` prop (read from context) |
| `ThreadPanel.scss` | Add resize handle styles, use CSS custom property for width |
| New: `ThreadContext.tsx` | Context definition, provider, hook |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State sharing | ThreadContext | Avoids prop drilling 40+ props through Space.tsx |
| Panel level | Space.tsx sibling | Matches Discord layout, clean flex behavior |
| Resize persistence | localStorage | Simple, no DB overhead, per-device preference |
| Resize bounds | 300px – 50vw | Ensures panel is usable but doesn't hide main chat |
| Mobile behavior | Full-screen overlay | Thread panel too narrow on mobile as sidebar |

---

_Created: 2026-03-09_
