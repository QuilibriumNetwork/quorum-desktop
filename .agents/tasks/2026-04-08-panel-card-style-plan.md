# Panel Card Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each desktop dropdown panel item its own card box (rounded, bordered, elevated background) to match the mobile MobileDrawer card pattern — without touching mobile styles.

**Architecture:** A new `.panel-item-box` CSS class (and `--interactive` modifier) is added to the shared `_dropdown-result-item.scss`. Two new color tokens (`--color-bg-panel-item`, `--color-bg-panel-item-hover`) are added to `_colors.scss` for both themes. Each panel component wraps its desktop item rows in `<div className="panel-item-box panel-item-box--interactive">`, exactly mirroring the existing mobile `mobile-drawer__item-box` pattern. The `DropdownPanel` container gets a border. The `ThreadsListPanel` section headers get a light restyle.

**Tech Stack:** SCSS (with existing `$rounded-lg`, `$border`, `$duration-150`, `$ease-in-out` variables), React TSX, CSS custom properties.

---

## Task 1: Add color tokens to `_colors.scss`

**Files:**
- Modify: `src/styles/_colors.scss`

- [ ] **Step 1: Add tokens to light theme**

In `src/styles/_colors.scss`, find the `/* mobile drawer */` block (around line 80). Insert after `--color-bg-mobile-drawer-item-active`:

```scss
  /* panel items (desktop dropdown panels) */
  --color-bg-panel-item: var(--surface-2);
  --color-bg-panel-item-hover: var(--surface-3);
```

The `:root` block ends at the `/* general */` comment near line 141. Insert before that comment.

- [ ] **Step 2: Add tokens to dark theme**

In `src/styles/_colors.scss`, find `html.dark {` (around line 144). The dark theme does not re-declare surface variables — it only overrides what differs. The `--color-bg-panel-item` tokens reference surface variables that are already overridden in the dark theme, so **no additional dark-theme declarations are needed**. The tokens will automatically resolve to the dark-theme surface values.

- [ ] **Step 3: Verify the file compiles**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

Expected: no errors related to _colors.scss (SCSS is not type-checked by tsc — this just confirms the project still compiles cleanly).

- [ ] **Step 4: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/styles/_colors.scss
git commit -m "style: add --color-bg-panel-item tokens for desktop panel cards"
```

---

## Task 2: Add `.panel-item-box` class to `_dropdown-result-item.scss`

**Files:**
- Modify: `src/styles/_dropdown-result-item.scss`

- [ ] **Step 1: Add the `.panel-item-box` class**

At the top of `src/styles/_dropdown-result-item.scss`, after the `@use 'variables' as *;` line, add:

```scss
// Card box for desktop panel items — mirrors mobile-drawer__item-box pattern
.panel-item-box {
  background: var(--color-bg-panel-item);
  border-radius: $rounded-lg;
  border: $border solid var(--color-border-default);
  margin: $s-1 $s-3;
  overflow: hidden;
  transition: background-color $duration-150 $ease-in-out;

  &--interactive {
    cursor: pointer;

    &:active {
      background: var(--color-bg-panel-item-hover);
    }
  }
}
```

- [ ] **Step 2: Add strip logic for `.dropdown-result-item` inside `.panel-item-box`**

In the existing `.dropdown-result-item` rule (which already has a `.mobile-drawer__item-box &` strip block), add a parallel block right after the mobile strip block:

```scss
  // Remove padding/border when inside desktop panel item box
  // The wrapper provides the card background and border
  .panel-item-box & {
    padding: 0;
    border-bottom: none;
    background-color: transparent !important;

    &:hover {
      background-color: transparent !important;
    }
  }
```

The full `.dropdown-result-item` rule should now look like:

```scss
.dropdown-result-item {
  padding: $s-4 $s-5;
  border-bottom: $border solid var(--surface-3);
  cursor: pointer;
  transition: all $duration-200 $ease-in-out;
  background-color: transparent;
  font-weight: $font-normal;

  &:hover {
    background-color: var(--surface-2);
  }

  // Remove padding when inside mobile drawer item box
  .mobile-drawer__item-box & {
    padding: 0;
    border-bottom: none;
    background-color: transparent !important;

    &:hover {
      background-color: transparent !important;
    }
  }

  // Remove padding/border when inside desktop panel item box
  .panel-item-box & {
    padding: 0;
    border-bottom: none;
    background-color: transparent !important;

    &:hover {
      background-color: transparent !important;
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/styles/_dropdown-result-item.scss
git commit -m "style: add .panel-item-box class for desktop panel card items"
```

---

## Task 3: Add border to `DropdownPanel`

**Files:**
- Modify: `src/components/ui/DropdownPanel.scss`

- [ ] **Step 1: Add border to `.dropdown-panel`**

In `src/components/ui/DropdownPanel.scss`, the `.dropdown-panel` rule currently is:

```scss
.dropdown-panel {
  background: var(--surface-0);
  border-radius: $rounded-lg;
  box-shadow: $shadow-lg;
  z-index: 10001;
  overflow: hidden;
  font-weight: normal;
  animation: dropdownPanelOpen $duration-200 $ease-out;
}
```

Add `border: $border solid var(--color-border-default);` after `box-shadow`:

```scss
.dropdown-panel {
  background: var(--surface-0);
  border-radius: $rounded-lg;
  box-shadow: $shadow-lg;
  border: $border solid var(--color-border-default);
  z-index: 10001;
  overflow: hidden;
  font-weight: normal;
  animation: dropdownPanelOpen $duration-200 $ease-out;
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/components/ui/DropdownPanel.scss
git commit -m "style: add border to DropdownPanel container"
```

---

## Task 4: Update `ThreadsListPanel` — card items + section header restyle

**Files:**
- Modify: `src/components/thread/ThreadsListPanel.tsx`
- Modify: `src/components/thread/ThreadsListPanel.scss`

- [ ] **Step 1: Wrap desktop thread items in `.panel-item-box`**

In `src/components/thread/ThreadsListPanel.tsx`, find the desktop render path (the `return` inside the final `if (isTouchDevice())` else branch, starting at line 161):

```tsx
    return (
      <div className="threads-results-list">
        {listItems.map((item, i) =>
          item.type === 'header' ? (
            <div key={`header-${i}`} className="threads-section-header">
              {item.label}
            </div>
          ) : (
            <ThreadListItem
              key={item.thread.threadId}
              thread={item.thread}
              onOpen={handleOpen}
              resolveDisplayName={resolveDisplayName}
            />
          )
        )}
      </div>
    );
```

Replace with:

```tsx
    return (
      <div className="threads-results-list">
        {listItems.map((item, i) =>
          item.type === 'header' ? (
            <div key={`header-${i}`} className="threads-section-header">
              {item.label}
            </div>
          ) : (
            <div key={item.thread.threadId} className="panel-item-box panel-item-box--interactive">
              <ThreadListItem
                thread={item.thread}
                onOpen={handleOpen}
                resolveDisplayName={resolveDisplayName}
              />
            </div>
          )
        )}
      </div>
    );
```

- [ ] **Step 2: Restyle section headers in `ThreadsListPanel.scss`**

In `src/components/thread/ThreadsListPanel.scss`, find the `.threads-section-header` rule:

```scss
.threads-section-header {
  padding: $s-2 $s-5 $s-1;
  font-size: $text-xs-responsive;
  font-weight: $font-bold;
  color: var(--color-text-subtle);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
```

Replace with:

```scss
.threads-section-header {
  position: sticky;
  top: 0;
  background: var(--surface-0);
  border-bottom: $border solid var(--color-border-muted);
  padding: $s-3 $s-4 $s-1;
  font-size: $text-xs;
  font-weight: $font-semibold;
  color: var(--color-text-subtle);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
```

- [ ] **Step 3: Adjust list padding in `ThreadsListPanel.scss`**

The `.threads-results-list` currently has `padding: 0 0 $s-3 0 !important`. The card margins (`$s-1 $s-3`) already provide horizontal spacing, so update the bottom padding and add a top padding to breathe:

```scss
.threads-results-list {
  @extend .dropdown-results-list;
  padding: $s-1 0 $s-3 0 !important;
}
```

- [ ] **Step 4: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/components/thread/ThreadsListPanel.tsx src/components/thread/ThreadsListPanel.scss
git commit -m "style: apply panel card items and restyle section headers in ThreadsListPanel"
```

---

## Task 5: Update `BookmarksPanel` — card items

**Files:**
- Modify: `src/components/bookmarks/BookmarksPanel.tsx`
- Modify: `src/components/bookmarks/BookmarksPanel.scss`

- [ ] **Step 1: Wrap desktop bookmark items in `.panel-item-box`**

In `src/components/bookmarks/BookmarksPanel.tsx`, find the desktop render path (the `return` after `// Desktop layout with virtualization`, around line 246):

```tsx
    // Desktop layout with virtualization - fix height issue
    return (
      <div className="bookmarks-list" style={{ height: '400px', minHeight: '200px' }}>
        <Virtuoso
          data={filteredBookmarks}
          itemContent={(index, bookmark) => (
            <BookmarkItem
              key={bookmark.bookmarkId}
              bookmark={bookmark}
              onJumpToMessage={handleJumpToMessage}
              onRemoveBookmark={handleRemoveBookmark}
              stickers={stickers}
              mapSenderToUser={mapSenderToUser}
              compactDate={isTouchDevice()}
            />
          )}
          style={{ height: '100%' }}
        />
      </div>
    );
```

Replace `itemContent` to wrap each item:

```tsx
    // Desktop layout with virtualization - fix height issue
    return (
      <div className="bookmarks-list" style={{ height: '400px', minHeight: '200px' }}>
        <Virtuoso
          data={filteredBookmarks}
          itemContent={(index, bookmark) => (
            <div className="panel-item-box panel-item-box--interactive">
              <BookmarkItem
                bookmark={bookmark}
                onJumpToMessage={handleJumpToMessage}
                onRemoveBookmark={handleRemoveBookmark}
                stickers={stickers}
                mapSenderToUser={mapSenderToUser}
                compactDate={isTouchDevice()}
              />
            </div>
          )}
          style={{ height: '100%' }}
        />
      </div>
    );
```

Note: `key` is removed from `BookmarkItem` — Virtuoso manages keys via `itemContent` index, so it was already a no-op.

- [ ] **Step 2: Add top padding to bookmarks list in `BookmarksPanel.scss`**

In `src/components/bookmarks/BookmarksPanel.scss`, find `.bookmarks-list`:

```scss
.bookmarks-list {
  @extend .dropdown-results-list;
  padding: 0 0 $s-4 0 !important;
}
```

Replace with:

```scss
.bookmarks-list {
  @extend .dropdown-results-list;
  padding: $s-1 0 $s-4 0 !important;
}
```

- [ ] **Step 3: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/components/bookmarks/BookmarksPanel.tsx src/components/bookmarks/BookmarksPanel.scss
git commit -m "style: apply panel card items in BookmarksPanel"
```

---

## Task 6: Update `NotificationPanel` — card items

**Files:**
- Modify: `src/components/notifications/NotificationPanel.tsx`
- Modify: `src/components/notifications/NotificationPanel.scss`

- [ ] **Step 1: Wrap desktop notification items in `.panel-item-box`**

In `src/components/notifications/NotificationPanel.tsx`, find the desktop render path (the `/* Desktop: Keep existing layout */` block, around line 289):

```tsx
            /* Desktop: Keep existing layout */
            <div className="notification-panel__list">
              {allNotifications.map((notification) => {
                const sender = mapSenderToUser(notification.message.content?.senderId);
                return (
                  <NotificationItem
                    key={`${notification.message.messageId}-${notification.channelId}`}
                    notification={notification}
                    onNavigate={handleNavigate}
                    displayName={sender?.displayName || t`Unknown User`}
                    mapSenderToUser={mapSenderToUser}
                    spaceRoles={spaceRoles}
                    spaceChannels={spaceChannels}
                  />
                );
              })}
            </div>
```

Replace with:

```tsx
            /* Desktop: card item layout */
            <div className="notification-panel__list">
              {allNotifications.map((notification) => {
                const sender = mapSenderToUser(notification.message.content?.senderId);
                return (
                  <div
                    key={`${notification.message.messageId}-${notification.channelId}`}
                    className="panel-item-box panel-item-box--interactive"
                  >
                    <NotificationItem
                      notification={notification}
                      onNavigate={handleNavigate}
                      displayName={sender?.displayName || t`Unknown User`}
                      mapSenderToUser={mapSenderToUser}
                      spaceRoles={spaceRoles}
                      spaceChannels={spaceChannels}
                    />
                  </div>
                );
              })}
            </div>
```

- [ ] **Step 2: Add top padding to notification list in `NotificationPanel.scss`**

In `src/components/notifications/NotificationPanel.scss`, find `.notification-panel__list`:

```scss
.notification-panel__list {
  padding: 0 0 $s-4 0;

  @media (hover: hover) and (pointer: fine) {
    overflow-y: auto;
    max-height: 350px;
  }
}
```

Replace with:

```scss
.notification-panel__list {
  padding: $s-1 0 $s-4 0;

  @media (hover: hover) and (pointer: fine) {
    overflow-y: auto;
    max-height: 350px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/components/notifications/NotificationPanel.tsx src/components/notifications/NotificationPanel.scss
git commit -m "style: apply panel card items in NotificationPanel"
```

---

## Task 7: Update `PinnedMessagesPanel` — card items

**Files:**
- Modify: `src/components/message/PinnedMessagesPanel.tsx`
- Modify: `src/components/message/PinnedMessagesPanel.scss`

- [ ] **Step 1: Wrap desktop pinned message items in `.panel-item-box`**

In `src/components/message/PinnedMessagesPanel.tsx`, find the desktop render path (the `/* Desktop: Keep existing layout */` block, around line 245):

```tsx
          ) : (
            /* Desktop: Keep existing layout */
            <Virtuoso
              style={{ height: '350px' }}
              totalCount={pinnedMessages.length}
              itemContent={(index) => (
                <PinnedMessageItem
                  message={pinnedMessages[index]}
                  mapSenderToUser={mapSenderToUser}
                  onJumpToMessage={handleJumpToMessage}
                  canPinMessages={canPinMessages}
                  togglePin={togglePin}
                  stickers={stickers}
                  spaceRoles={spaceRoles}
                  spaceChannels={spaceChannels}
                  onChannelClick={onChannelClick}
                  spaceId={spaceId}
                />
              )}
              className="pinned-messages-list"
            />
```

Replace with:

```tsx
          ) : (
            /* Desktop: card item layout */
            <Virtuoso
              style={{ height: '350px' }}
              totalCount={pinnedMessages.length}
              itemContent={(index) => (
                <div className="panel-item-box panel-item-box--interactive">
                  <PinnedMessageItem
                    message={pinnedMessages[index]}
                    mapSenderToUser={mapSenderToUser}
                    onJumpToMessage={handleJumpToMessage}
                    canPinMessages={canPinMessages}
                    togglePin={togglePin}
                    stickers={stickers}
                    spaceRoles={spaceRoles}
                    spaceChannels={spaceChannels}
                    onChannelClick={onChannelClick}
                    spaceId={spaceId}
                  />
                </div>
              )}
              className="pinned-messages-list"
            />
```

- [ ] **Step 2: Add top padding to pinned list in `PinnedMessagesPanel.scss`**

In `src/components/message/PinnedMessagesPanel.scss`, find `.pinned-messages-list`:

```scss
.pinned-messages-list {
  @extend .dropdown-results-list;
  padding: 0 0 $s-4 0 !important;
}
```

Replace with:

```scss
.pinned-messages-list {
  @extend .dropdown-results-list;
  padding: $s-1 0 $s-4 0 !important;
}
```

- [ ] **Step 3: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/components/message/PinnedMessagesPanel.tsx src/components/message/PinnedMessagesPanel.scss
git commit -m "style: apply panel card items in PinnedMessagesPanel"
```

---

## Task 8: Update `SearchResultItem` — card items

**Files:**
- Modify: `src/components/search/SearchResults.tsx`
- Modify: `src/components/search/SearchResultItem.scss`

- [ ] **Step 1: Find the desktop search result render path**

Read `src/components/search/SearchResults.tsx` to find where `SearchResultItem` is rendered on desktop (not inside `mobile-drawer__item-box`). The pattern will be a Virtuoso or map call that renders `<SearchResultItem>` directly without a wrapper on desktop.

- [ ] **Step 2: Wrap desktop search result items in `.panel-item-box`**

In `src/components/search/SearchResults.tsx`, find the desktop itemContent render. It will look like:

```tsx
itemContent={(index, result) => (
  <SearchResultItem
    result={result}
    ...props
  />
)}
```

Wrap it:

```tsx
itemContent={(index, result) => (
  <div className="panel-item-box panel-item-box--interactive">
    <SearchResultItem
      result={result}
      ...props
    />
  </div>
)}
```

If the desktop path uses `.map()` instead of Virtuoso, wrap the same way inside the map.

- [ ] **Step 3: Add top padding to search results list in `SearchResultItem.scss` or `SearchResults.scss`**

In `src/components/search/SearchResults.scss`, find `.search-results-list` (which extends `.dropdown-results-list`). Add top padding:

```scss
.search-results-list {
  @extend .dropdown-results-list;
  padding: $s-1 0 $s-3 0 !important;
}
```

If `.search-results-list` is already defined with a padding override, update that line. If it has no padding override, add `padding: $s-1 0 $s-3 0 !important;`.

- [ ] **Step 4: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/components/search/SearchResults.tsx src/components/search/SearchResults.scss
git commit -m "style: apply panel card items in SearchResults"
```

---

## Task 9: Final type-check and visual verification

- [ ] **Step 1: Run type-check**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 2: Run lint**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
yarn lint 2>&1 | tail -20
```

Expected: no new lint errors introduced.

- [ ] **Step 3: Visual check list**

Open the app and verify each panel:
- [ ] Bookmarks panel: items have card boxes, `$s-1` top gap between header and first card
- [ ] Notifications panel: items have card boxes, top gap present
- [ ] Pinned messages panel: items have card boxes, top gap present
- [ ] Search results: items have card boxes, top gap present
- [ ] Threads panel: items have card boxes, section headers are sticky with border-bottom separator
- [ ] All panels: `DropdownPanel` container has a visible border
- [ ] Mobile: unchanged — all panels still use `mobile-drawer__item-box` with no visual change

---

*Last updated: 2026-04-08*
