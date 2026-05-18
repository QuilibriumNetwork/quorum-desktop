# DM User Profile Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable user profile sidebar to the DM conversation page that shows the other user's avatar, display name, address, bio (empty state), and a notes placeholder.

**Architecture:** A new `DMUserProfileSidebar` component receives the other user's data as props and renders a profile card. `DirectMessage.tsx` adds a `showProfile` boolean state, a `user` icon toggle button in the header, and renders the sidebar inline on desktop or inside a `MobileDrawer` on mobile/tablet — mirroring the Members List sidebar pattern from `Channel.tsx`.

**Tech Stack:** React, TypeScript, Tailwind CSS, SCSS, Lingui (i18n), `@quilibrium/quorum-shared` primitives (`Button`, `Tooltip`, `UserAvatar`, `ClickToCopyContent`), `MobileDrawer` from `src/components/ui/`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/direct/DMUserProfileSidebar.tsx` | Profile panel content: avatar, identity, bio section, notes placeholder |
| Create | `src/components/direct/DMUserProfileSidebar.scss` | Sidebar-specific styles |
| Modify | `src/components/direct/DirectMessage.tsx` | State, toggle button, desktop sidebar + mobile drawer render |

---

## Task 1: Create `DMUserProfileSidebar` component

**Files:**
- Create: `src/components/direct/DMUserProfileSidebar.tsx`
- Create: `src/components/direct/DMUserProfileSidebar.scss`

- [ ] **Step 1: Create the SCSS file**

Create `src/components/direct/DMUserProfileSidebar.scss`:

```scss
.dm-profile-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;

  .dm-profile-identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px 16px;
    gap: 8px;
  }

  .dm-profile-name {
    font-weight: 600;
    font-size: 1rem;
    max-width: 100%;
    text-align: center;
  }

  .dm-profile-address {
    display: flex;
    justify-content: center;
  }

  .dm-profile-section {
    padding: 12px 16px;
    border-top: 1px solid var(--border-default);
  }

  .dm-profile-section-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
}
```

- [ ] **Step 2: Create the component**

Create `src/components/direct/DMUserProfileSidebar.tsx`:

```tsx
import React from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { UserAvatar } from '../user/UserAvatar';
import { ClickToCopyContent } from '../ui';
import { getAddressSuffix } from '../../utils';
import './DMUserProfileSidebar.scss';

interface DMUserProfileSidebarProps {
  user: {
    address: string;
    displayName?: string;
    userIcon?: string;
    bio?: string;
  };
}

export const DMUserProfileSidebar: React.FC<DMUserProfileSidebarProps> = ({ user }) => {
  return (
    <div className="dm-profile-sidebar">
      {/* Identity block */}
      <div className="dm-profile-identity">
        <UserAvatar
          userIcon={user.userIcon}
          displayName={user.displayName ?? user.address}
          address={user.address}
          size={96}
        />
        <span className="dm-profile-name truncate text-main">
          {user.displayName ?? user.address}
        </span>
        <div className="dm-profile-address">
          <ClickToCopyContent
            text={user.address}
            tooltipText={t`Copy address`}
            tooltipLocation="right"
            className="text-subtle"
            iconPosition="right"
            iconClassName="text-subtle hover:text-surface-7"
            iconSize="xs"
            textSize="xs"
          >
            {getAddressSuffix(user.address)}
          </ClickToCopyContent>
        </div>
      </div>

      {/* Bio section */}
      <div className="dm-profile-section">
        <div className="dm-profile-section-label text-subtle">
          <Trans>Bio</Trans>
        </div>
        {user.bio ? (
          <p className="text-sm text-main">{user.bio}</p>
        ) : (
          <p className="text-sm text-subtle">{t`No bio yet.`}</p>
        )}
      </div>

      {/* Notes placeholder — replaced when user-notes feature lands */}
      <div className="dm-profile-section">
        <div className="dm-profile-section-label text-subtle">
          <Trans>Notes</Trans>
        </div>
        <p className="text-sm text-subtle">{t`Coming soon`}</p>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from the project root:
```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
Expected: no errors related to `DMUserProfileSidebar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/direct/DMUserProfileSidebar.tsx src/components/direct/DMUserProfileSidebar.scss
git commit -m "feat: add DMUserProfileSidebar component"
```

---

## Task 2: Wire sidebar into `DirectMessage.tsx`

**Files:**
- Modify: `src/components/direct/DirectMessage.tsx`

### 2a — Add imports and state

- [ ] **Step 1: Add imports**

In `src/components/direct/DirectMessage.tsx`, the existing imports block already contains `Button`, `Flex`, `Tooltip` from `'../primitives'` and `MobileDrawer` is NOT yet imported.

Add these two imports — one is a new local component, one is from `'../ui'`:

After the existing `import { BookmarksPanel } from '../bookmarks/BookmarksPanel';` line, add:

```tsx
import { MobileDrawer } from '../ui';
import { DMUserProfileSidebar } from './DMUserProfileSidebar';
```

- [ ] **Step 2: Add `showProfile` state**

In `DirectMessage.tsx`, after the existing state declarations near the top of the component (around line 66 where `showEmojiPanel` is declared), add:

```tsx
const [showProfile, setShowProfile] = useState(false);
```

- [ ] **Step 3: Reset `showProfile` when conversation changes**

In the existing `useEffect` that resets state on address change (around line 585–591 — the one that calls `setScrollToMessageId(undefined)` and `setNewMessagesSeparator(null)`), add one more reset:

```tsx
useEffect(() => {
  setScrollToMessageId(undefined);
  setNewMessagesSeparator(null);
  setShowProfile(false);  // ← add this line
  latestTimestampRef.current = 0;
  lastSavedTimestampRef.current = 0;
}, [address]);
```

### 2b — Add the toggle button to the header

- [ ] **Step 4: Add the profile toggle button**

In `DirectMessage.tsx`, find the controls `<Flex>` in the header (around line 767 — the one that contains the settings button, bookmarks button, and search button). Add the profile toggle button **before** the settings button (leftmost position in the controls row):

```tsx
{/* Controls - right side on both mobile and desktop */}
<Flex className="items-center gap-3 sm:gap-2">
  {/* User profile toggle — NEW */}
  <Tooltip
    id="dm-profile-toggle"
    content={t`User Profile`}
    place="bottom"
    showOnTouch={false}
  >
    <Button
      type="unstyled"
      onClick={() => setShowProfile(!showProfile)}
      className={`header-icon-button ${showProfile ? 'active' : ''}`}
      iconName="user"
      iconSize={headerIconSize}
      iconOnly
    />
  </Tooltip>

  {/* existing settings button follows */}
  <Tooltip
    id="dm-settings-toggle"
    ...
```

### 2c — Add the desktop sidebar

- [ ] **Step 5: Add desktop inline sidebar**

Find the content area div at the end of the component (around line 888–996):

```tsx
{/* Content area - flex container for messages and sidebar */}
<div className="flex flex-1 min-w-0">
  {/* Messages and composer area */}
  <div className="flex flex-col flex-1 min-w-0">
    ...all existing message list + composer markup...
  </div>

</div>
```

Add the desktop sidebar **inside** the `flex flex-1 min-w-0` div, after the messages+composer div and before its closing tag:

```tsx
{/* Desktop profile sidebar — hidden on mobile/tablet, shown when toggled */}
{showProfile && !isMobile && !isTablet && (
  <div className="hidden lg:flex flex-col flex-shrink-0 w-[var(--sidebar-right-width)] bg-chat border-l border-default">
    <DMUserProfileSidebar user={otherUser} />
  </div>
)}
```

### 2d — Add the mobile drawer

- [ ] **Step 6: Add the MobileDrawer for mobile/tablet**

After the closing `</Flex>` tag of the main `<Flex direction="column">` wrapper (and before the final `</div>` closing `chat-container`), add:

```tsx
{/* Mobile/tablet profile drawer */}
{(isMobile || isTablet) && (
  <MobileDrawer
    isOpen={showProfile}
    onClose={() => setShowProfile(false)}
    showCloseButton={false}
    enableSwipeToClose={true}
    ariaLabel={t`User profile`}
  >
    <DMUserProfileSidebar user={otherUser} />
  </MobileDrawer>
)}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/direct/DirectMessage.tsx
git commit -m "feat: wire DMUserProfileSidebar into DM header and content area"
```

---

## Task 3: Manual verification

No automated tests for UI layout — verify manually in the running app.

- [ ] **Step 1: Start the dev server**

```bash
yarn dev
```

- [ ] **Step 2: Verify desktop behavior**

Open a DM conversation on a screen ≥1024px wide.

- [ ] Header shows a `user` icon button to the left of the settings gear
- [ ] Clicking the icon opens the sidebar (260px wide, right of messages)
- [ ] Sidebar shows: 96px avatar, display name (truncated if long), address suffix with copy button, Bio section with "No bio yet.", Notes section with "Coming soon"
- [ ] Clicking the icon again closes the sidebar
- [ ] The active state (highlighted icon) is shown when sidebar is open
- [ ] Navigating to a different DM resets the sidebar to closed

- [ ] **Step 3: Verify mobile behavior**

Resize browser to <1024px (or use DevTools device emulation).

- [ ] The `user` icon is visible in the header
- [ ] Clicking the icon opens a `MobileDrawer` from the bottom
- [ ] Sidebar content is the same as desktop
- [ ] Swiping down closes the drawer
- [ ] Navigating to a different DM resets the drawer to closed

- [ ] **Step 4: Verify truncation**

If possible, test with a user whose display name is very long (>20 chars) — confirm the name truncates with ellipsis and doesn't overflow the sidebar width.

- [ ] **Step 5: Final commit if any style fixes were needed**

```bash
git add -p
git commit -m "fix: dm profile sidebar style adjustments after visual testing"
```

---

*Last updated: 2026-05-16*
