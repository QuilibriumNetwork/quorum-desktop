---
type: task
title: DM User Profile Sidebar — Design Spec
status: design
created: 2026-05-16T00:00:00.000Z
updated: 2026-05-16T00:00:00.000Z
---

# DM User Profile Sidebar — Design Spec

A panel that opens from a header icon in the DM conversation page, showing the other user's public profile information. Mirrors the Members List sidebar in the Channel page.

---

## 1. Feature Overview

- A `user` icon button in the DM header toggles the profile sidebar
- Desktop: inline panel to the right of the message area (260px, matching `--sidebar-right-width`)
- Mobile: `MobileDrawer` (bottom sheet), same pattern as the Channel members list
- Shows: large avatar, display name (truncated), address suffix with copy, bio (empty state), notes placeholder
- Notes section is a placeholder — wired up when the User Notes feature lands (see `2026-05-16-user-notes-design.md`)
- Bio section shows an empty state since the bio field is not yet populated from the network

---

## 2. Layout

```
┌─────────────────────────┐
│                         │
│       [Avatar 96px]     │  ← centered
│                         │
│      Display Name       │  ← centered, truncated (single line ellipsis)
│   …address-suffix  📋   │  ← centered, ClickToCopyContent
│                         │
│  ─────────────────────  │
│  BIO                    │  ← section label (muted, uppercase, small)
│  No bio yet.            │  ← empty state text
│                         │
│  ─────────────────────  │
│  NOTES                  │  ← section label (muted, uppercase, small)
│  (placeholder)          │  ← stub, replaced when user-notes feature lands
└─────────────────────────┘
```

- Avatar: 96px, centered horizontally, with padding above
- Display name: centered, `truncate` class (single-line ellipsis), `font-semibold`
- Address: centered, truncated suffix via `getAddressSuffix()`, `ClickToCopyContent` with copy icon
- Section dividers: thin horizontal rule between identity block and each section
- No close button — sidebar is toggled exclusively via the header icon button (click to open, click again to close). Mobile uses swipe-to-close on `MobileDrawer`.

---

## 3. Data

The sidebar receives `otherUser` as props — the same object already built in `DirectMessage.tsx`:

```typescript
{
  address: string;
  displayName?: string;
  userIcon?: string;
}
```

The `bio` field comes from `quorum-shared`'s `UserProfile` type (`bio?: string`) but is not currently populated from the network. The sidebar renders an empty state when `bio` is absent or empty.

No new data fetching. No new hooks. No quorum-shared changes.

---

## 4. Architecture

### New component: `DMUserProfileSidebar`

**File:** `src/components/direct/DMUserProfileSidebar.tsx`

Props:
```typescript
interface DMUserProfileSidebarProps {
  user: {
    address: string;
    displayName?: string;
    userIcon?: string;
    bio?: string;
  };
  onClose: () => void;
}
```

Renders the full sidebar content (avatar, identity, bio section, notes placeholder). No internal state.

**Styles:** `src/components/direct/DMUserProfileSidebar.scss` (or co-located CSS module following project convention)

---

### Changes to `DirectMessage.tsx`

1. **New state:** `const [showProfile, setShowProfile] = useState(false);`

2. **Header button** — added to the controls row alongside settings/bookmarks/search. Uses `iconName="user"` (single-user icon, distinct from channel's `iconName="users"`):
   ```tsx
   <Tooltip id="dm-profile-toggle" content={t`User Profile`} showOnTouch={false}>
     <Button
       type="unstyled"
       onClick={() => setShowProfile(!showProfile)}
       className={`header-icon-button ${showProfile ? 'active' : ''}`}
       iconName="user"
       iconSize={headerIconSize}
       iconOnly
     />
   </Tooltip>
   ```

3. **Content area layout** — wrap messages+composer and sidebar in a flex row:
   ```tsx
   <div className="flex flex-1 min-w-0">
     {/* Messages and composer — existing markup */}
     <div className="flex flex-col flex-1 min-w-0">
       ...
     </div>

     {/* Desktop sidebar */}
     {showProfile && !isMobile && !isTablet && (
       <div className="dm-profile-sidebar" style={{ width: 'var(--sidebar-right-width)' }}>
         <DMUserProfileSidebar user={otherUser} onClose={() => setShowProfile(false)} />
       </div>
     )}
   </div>

   {/* Mobile drawer */}
   {(isMobile || isTablet) && (
     <MobileDrawer
       isOpen={showProfile}
       onClose={() => setShowProfile(false)}
       title={otherUser.displayName ?? getAddressSuffix(otherUser.address)}
       enableSwipeToClose
     >
       <DMUserProfileSidebar user={otherUser} onClose={() => setShowProfile(false)} />
     </MobileDrawer>
   )}
   ```

   > **Note:** `isMobile` and `isTablet` are already available from `useResponsiveLayoutContext()` in `DirectMessage.tsx`.

---

## 5. Files

| Action | File | Description |
|--------|------|-------------|
| Create | `src/components/direct/DMUserProfileSidebar.tsx` | New sidebar component |
| Create | `src/components/direct/DMUserProfileSidebar.scss` | Sidebar styles |
| Modify | `src/components/direct/DirectMessage.tsx` | State, header button, sidebar/drawer render |

---

## 6. Styling Notes

- Sidebar container: `border-left` on the sidebar div, matching the visual separation style used in `channel-users-sidebar`
- Section labels: `text-label text-subtle uppercase tracking-wide` — follow existing patterns in `UserProfile.tsx`
- Empty state text: `text-subtle text-sm` — consistent with other empty states in the app

---

## 7. Notes Placeholder

Until the User Notes feature is implemented, the Notes section renders a static placeholder:

```tsx
<div className="profile-section">
  <div className="profile-section-label"><Trans>Notes</Trans></div>
  <div className="text-subtle text-sm">{t`Coming soon`}</div>
</div>
```

When the User Notes feature lands (see `2026-05-16-user-notes-design.md`), this placeholder is replaced with the `UserNoteTextarea` component described in that spec. The section label and layout do not change.

---

## 8. Out of Scope (v1)

- Online/away status indicator (disabled app-wide, see `UserOnlineStateIndicator.tsx`)
- Action buttons (Send Message, Mute) — those belong in the floating `UserProfile.tsx` popup, not here
- Role badges — DMs have no concept of roles
- Bio editing from this sidebar
- Full address display (truncated suffix only, consistent with the rest of the app)

---

## 9. Open Questions / Follow-up

- Avatar size (96px) is a starting point — may be adjusted after visual testing
- Centering vs. left-aligned layout for the identity block can be revisited after the first implementation

---

*Last updated: 2026-05-16*
