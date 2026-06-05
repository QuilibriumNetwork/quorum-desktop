# Drag-to-Resize Sidebar — Implementation Plan (Track E)

Plan for Track E of [2026-06-03-new-ui-shell-continuation.md](./2026-06-03-new-ui-shell-continuation.md). Replaces the explicit collapse/expand buttons in DM and Spaces sidebar headers with a draggable border between the sidebar and the main content area. NavRail collapse toggle is untouched.

---

## Decisions made up-front

These were the four plan deliverables flagged in the dispatcher. Resolutions:

### a) Exact bounds for free-drag width

- **Minimum**: 240px. Tight but still readable for the two-line row format from Track D (avatar 42 + name + timestamp). Below this, names truncate aggressively.
- **Maximum**: 480px. Wider feels disconnected from the main chat and wastes screen space on common 1280-1440px laptop displays.
- **Snap threshold**: dragging below 200px snaps to the 72px collapsed avatar strip. Snap is one-way: releasing below 200 → snap to 72; the next drag from 72 restores the most recent free-drag width (stored as `lastFreeWidth`).

### b) Hover-delay implementation

- `mousemove` on the handle starts a 1000ms timer (NOT `mouseenter`, since the user might already be hovering when the page loads or after a router transition)
- Any `mouseleave` clears the timer immediately
- When the timer fires, set `data-hover-armed="true"` on the handle div → CSS targets this attribute to apply the thickened + accent-tinted style
- During an active drag, the timer is suppressed and `data-hover-armed` is forced on (no flicker)

Rationale: the "armed" attribute keeps all hover styling in CSS, with the timer doing only the boolean toggle. Simpler than juggling React state for a purely visual effect.

### c) Drag handle interaction with OfflineBanner

OfflineBanner pushes `.app-shell` down by 32px via a `body.offline-banner-visible` class (sets `top: 32px` on `.app-shell`). Since the drag handle lives **inside** `.app-shell` (positioned absolutely on the sidebar's right edge), it inherits the correct offset automatically. **No explicit top-offset logic needed.**

### d) State migration for existing users

Current state: `shell.sidebarCollapsed` boolean in localStorage. New state: `shell.sidebarWidth` numeric in localStorage.

Migration on first load (idempotent):
1. Read `shell.sidebarWidth` — if present, use it.
2. Otherwise read `shell.sidebarCollapsed`:
   - `'true'` → set `sidebarWidth = 72`
   - `'false'` or missing → set `sidebarWidth = 300` (current expanded default)
3. Write the resulting `sidebarWidth` to localStorage.
4. Leave `shell.sidebarCollapsed` in place for one release (don't delete) — if a user rolls back, their old preference still works.

`sidebarCollapsed` consumers continue to work via a derived boolean: `sidebarCollapsed = sidebarWidth <= 72`.

---

## Build sequence

1. **State refactor (no UI change)**
   - In [useShellState.ts](../../src/components/shell/useShellState.ts), add `sidebarWidth: number` to `ShellState`, plus `setSidebarWidth: (n: number) => void`
   - Add `STORAGE_KEY_SIDEBAR_WIDTH = 'shell.sidebarWidth'` and `STORAGE_KEY_LAST_FREE_WIDTH = 'shell.lastFreeWidth'`
   - On mount, run the migration logic from decision (d)
   - Derive `sidebarCollapsed` from `sidebarWidth <= 72` (keep the existing field name and type for backwards compatibility with all consumers)
   - `toggleSidebarCollapsed` becomes: if collapsed → restore `lastFreeWidth` (default 300); if expanded → save current as `lastFreeWidth`, set width to 72
   - Verify: existing collapse-toggle code paths still work even though the underlying state changed

2. **Width applied via CSS variable**
   - In [AppShell.tsx](../../src/components/shell/AppShell.tsx), set `style={{ '--shell-sidebar-width': sidebarWidth + 'px' }}` on the `.app-shell` root
   - In [AppShell.scss](../../src/components/shell/AppShell.scss), change `.app-shell__sidebar--expanded { width: $sidebar-width }` to `width: var(--shell-sidebar-width, #{$sidebar-width})` so the SCSS variable becomes the fallback only
   - `--collapsed` keeps `width: $sidebar-width-collapsed` (72px hardcoded — collapsed state isn't user-resizable)
   - Sidebar transition stays for collapse animations but is **suppressed during active drag** (toggle a `.app-shell--dragging` class that sets `transition: none` on the sidebar)
   - Verify: width persists across reloads, collapse still animates, drag will be wired in step 4

3. **Drag handle markup + base CSS**
   - Add `<div className="app-shell__drag-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" />` inside `.app-shell__sidebar` (after `<Sidebar>`)
   - `.app-shell__sidebar` gets `position: relative` so the handle can position absolutely
   - Handle styles: `position: absolute; right: -3px; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 5`
   - `&[data-hover-armed="true"]::after`: 3px-wide tinted ribbon centered on the handle, color via `var(--shell-drag-handle-hover-color)`
   - Theme tokens: in `_colors.scss`, define `--shell-drag-handle-hover-color: var(--accent-300)` on `:root`, override on `html.dark` to `var(--accent-700)`
   - Render-gate: don't render the handle when `sidebarMode === 'channels'`, `sidebarMode === 'hidden'`, `viewport !== 'desktop'`, or `sidebarCollapsed === true` (no point dragging a 72px strip — clicking the avatars is the expand affordance)
   - Verify visually before wiring the drag logic

4. **Hover-arm logic**
   - Inline hook `useHoverArm(ref, delayMs)` inside `AppShell.tsx`:
     - `mousemove` → start/reset timer
     - `mouseleave` → clear timer + remove `data-hover-armed` attribute
     - Timer fires → set `data-hover-armed="true"` attribute on `ref.current`
   - During drag, force the attribute on (decision b)
   - Verify: 1s after stopping mouse over the border, the ribbon appears; leaving immediately removes it

5. **Drag mechanics**
   - `onMouseDown` on the handle: capture `startX = e.clientX`, `startWidth = sidebarWidth`, set `document.body.style.cursor = 'col-resize'` and `userSelect = 'none'`, attach window-level `mousemove` and `mouseup` listeners, add `.app-shell--dragging` class to root
   - `mousemove`: `newWidth = startWidth + (e.clientX - startX)`, clamp to `[200, 480]`, call `setSidebarWidth(newWidth)` (which updates state immediately; CSS variable picks it up next paint)
   - `mouseup`: persist to localStorage. If final width ≤ 200, set `sidebarWidth = 72` (snap) and save current pre-snap value as `lastFreeWidth`. Otherwise save final width as both `sidebarWidth` and `lastFreeWidth`. Clean up cursor, userSelect, listeners, and `.app-shell--dragging` class.
   - Use a `ref` for `isDragging` to avoid re-renders during mousemove; the state update is solely for the CSS variable
   - Match the proven pattern from [ThreadPanel.tsx:120-171](../../src/components/thread/ThreadPanel.tsx#L120-L171)

6. **Remove the collapse/expand buttons**
   - Delete from [SpacesSidebar.tsx:117-127](../../src/components/shell/SpacesSidebar.tsx#L117-L127) (collapsed-strip expand button)
   - Delete from [SpacesSidebar.tsx:181-190](../../src/components/shell/SpacesSidebar.tsx#L181-L190) (expanded-header collapse button)
   - Delete from [DirectMessageContactsList.tsx:326-337](../../src/components/direct/DirectMessageContactsList.tsx#L326-L337) (collapsed-strip expand button)
   - Delete from [DirectMessageContactsList.tsx:421-437](../../src/components/direct/DirectMessageContactsList.tsx#L421-L437) (expanded-header Tooltip-wrapped collapse button)
   - Both files: drop the now-unused `showCollapseToggle` const, the `useShellState` import if it's only used for the toggle, and any related imports (`Tooltip`, the collapse/expand icon names)
   - Verify: headers still render correctly, no console errors about missing props

7. **Touch / tablet / phone guards**
   - Handle render is already gated to `viewport === 'desktop'` from step 3
   - Belt-and-suspenders: also set `pointer-events: none` on the handle when CSS detects touch via `@media (hover: none)`
   - Phone drawer pattern is untouched (drawer doesn't have a sidebar in the resizable sense)

8. **Accessibility**
   - Handle has `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow={sidebarWidth}`, `aria-valuemin={200}`, `aria-valuemax={480}`, `aria-label="Resize sidebar"`
   - Keyboard support: when handle is focused (via Tab), Left/Right arrows adjust width by 16px; Home → 240, End → 480, Esc → blur. This is a bonus, not required for the dispatcher's acceptance criteria — flag as nice-to-have if time runs short.

---

## Files touched

**Primary (state + layout):**
- [useShellState.ts](../../src/components/shell/useShellState.ts) — add `sidebarWidth`, `setSidebarWidth`, migration, derive `sidebarCollapsed`, update `toggleSidebarCollapsed`
- [AppShell.tsx](../../src/components/shell/AppShell.tsx) — render the drag handle, CSS variable on root, `useHoverArm` hook
- [AppShell.scss](../../src/components/shell/AppShell.scss) — sidebar width uses CSS var, drag handle styles, `.app-shell--dragging` transition suppression

**Theme tokens:**
- [_colors.scss](../../src/styles/_colors.scss) — `--shell-drag-handle-hover-color` light/dark

**Buttons removed:**
- [SpacesSidebar.tsx](../../src/components/shell/SpacesSidebar.tsx) — drop both collapse/expand buttons
- [DirectMessageContactsList.tsx](../../src/components/direct/DirectMessageContactsList.tsx) — drop both collapse/expand buttons

**Not touched:**
- NavRail collapse toggle — explicitly out of scope
- Channels sidebar — explicitly non-resizable (handle isn't rendered)
- Phone drawer — explicitly out of scope

---

## Risks

- **Migration on first load**: an `useEffect` that reads localStorage runs after the first paint, so the very first render uses the default 300px even if the user had it set to 250px. Visible flash of "snap to default then jump to saved" is possible. Mitigate by initializing the `useState` with a synchronous localStorage read (`useState(() => readWidth())`) — `readBool` already does this pattern, just port it for the number value.
- **Sidebar transition fighting the drag**: if the CSS `transition: width 150ms` is active during mousemove, the sidebar visually lags 150ms behind the cursor. The `.app-shell--dragging` class with `transition: none` on `.app-shell__sidebar` is mandatory, not optional.
- **Collapsed-strip "expand" gesture**: today the avatar strip has an explicit expand button. After removal, the only way to expand is to drag the handle from 72px. Verify there's no path where the user gets "stuck" at 72px on a non-channels mode — the handle should be rendered (per step 3 gate) once `sidebarCollapsed === true` becomes the no-render condition for the handle... **wait, that creates a deadlock**.
  - **Resolution**: render the handle on the collapsed strip's right edge too (it's still a draggable border). The render gate is "`viewport === 'desktop'` AND `sidebarMode !== 'channels'` AND `sidebarMode !== 'hidden'`". Collapsed strip ≠ no handle. Dragging the handle right from 72px expands the strip and restores `lastFreeWidth` once the user releases above 200px.
  - Step 3 is updated implicitly by this resolution — don't gate on `sidebarCollapsed`.

---

## Definition of done

- [ ] No collapse icons in DM or Spaces sidebar headers (rail collapse toggle in NavRail stays)
- [ ] Hovering the sidebar→main border for ~1s reveals a soft accent-tinted ribbon
- [ ] Dragging is smooth (no jank, no text selection, no transition lag)
- [ ] Width persists across reloads
- [ ] Avatar-strip snap-to-72 works at low widths; expanding from 72 restores `lastFreeWidth`
- [ ] Channels sidebar is non-resizable (no handle rendered)
- [ ] Phone and tablet behavior unchanged (no handle rendered)
- [ ] Theme-aware accent verified in both light and dark
- [ ] OfflineBanner visible → handle still aligns correctly with sidebar edge
- [ ] Existing users with `shell.sidebarCollapsed = false` see expanded sidebar at default width (300px); `= true` users see collapsed strip

---

*Last updated: 2026-06-03*
