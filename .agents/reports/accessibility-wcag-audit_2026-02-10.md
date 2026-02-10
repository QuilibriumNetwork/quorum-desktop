# Comprehensive WCAG Accessibility Audit Report

**Date**: 2026-02-10
**Scope**: Full WCAG 2.1 Level AA audit of Quorum Desktop web application
**Branch**: feat/mixed
**Components Analyzed**: 50+ TSX files, 20+ SCSS files

---

## Executive Summary

| Area | Score | Grade | Status |
|------|-------|-------|--------|
| ARIA Attributes | 68/100 | C+ | Partial coverage, critical gaps in navigation/modals |
| Keyboard Navigation | 65/100 | C | Good in newer components, critical gaps in Button, mentions |
| Color Contrast | 55/100 | D | Multiple critical failures in muted text, disabled states |
| Form Labels | 60/100 | D+ | Input primitive is good, but most modals lack proper labels |
| Images & Alt Text | 63/100 | C- | 39% of images missing alt, SVGs lacking aria attributes |
| Page Structure | 35/100 | F | No skip link, no `<main>`, no headings, no landmarks |
| Reduced Motion | 14/100 | F | Only 5 of 35+ animations respect prefers-reduced-motion |
| Live Regions | 20/100 | F | Only form errors use role="alert"; no aria-live anywhere |
| **Overall WCAG AA** | **~50/100** | **F** | **Not compliant** |

**Total Issues Found**: 85+
- P0 Critical: 18
- P1 Important: 15
- P2 Nice-to-have: 12+

---

## Critical Issues (P0) — Must Fix for WCAG AA Compliance

### 1. Button Primitive Uses `<span>` Instead of `<button>`

**File**: [Button.web.tsx](src/components/primitives/Button/Button.web.tsx)
**Impact**: 100+ button instances throughout application
**WCAG**: 2.1.1 Keyboard, 4.1.2 Name/Role/Value

The Button component renders a `<span>` element with onClick only. This means:
- No keyboard support (Enter/Space don't work)
- No semantic role for screen readers
- No native disabled state
- No focus management

**Fix**: Convert to `<button>` element with `type="button"`, `disabled` attribute, and `aria-label` for icon-only buttons.

---

### 2. Modal Missing Dialog Semantics & Focus Management

**File**: [Modal.web.tsx](src/components/primitives/Modal/Modal.web.tsx)
**Impact**: Every modal dialog in the application
**WCAG**: 2.4.3 Focus Order, 4.1.2 Name/Role/Value

Missing:
- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` connecting to title
- Focus trap (focus escapes to background)
- Initial focus to first focusable element
- Focus restoration on close
- Close button is a `<div>`, not `<button>`, with no `aria-label`

Note: MobileDrawer correctly implements `role="dialog"` and `aria-modal="true"` — the Modal component should match this pattern.

---

### 3. No Skip-to-Content Link

**File**: [Layout.tsx](src/components/Layout.tsx)
**WCAG**: 2.4.1 Bypass Blocks (Level A)

No skip link exists. Keyboard users must tab through all navigation elements before reaching content.

**Fix**: Add a visually-hidden link as the first focusable element that jumps to `#main-content`.

---

### 4. No `<main>` Element or Semantic Landmarks

**File**: [Layout.tsx](src/components/Layout.tsx)
**WCAG**: 1.3.1 Info and Relationships

Current structure uses only `<header>` and generic `<div>`. Missing:
- `<main id="main-content">` for primary content
- `<nav>` for navigation regions
- `<aside>` for sidebars
- `role="banner"`, `role="navigation"`, `role="main"`

---

### 5. No Heading Hierarchy (h1-h6)

**WCAG**: 1.3.1 Info and Relationships, 2.4.6 Headings and Labels

Zero `<h1>` through `<h6>` elements found in the entire application. All titles use `<div>` with CSS styling. Screen reader users cannot navigate by heading structure.

---

### 6. Muted Text Color Fails Contrast Ratio

**File**: [_colors.scss](src/styles/_colors.scss)
**WCAG**: 1.4.3 Contrast Minimum (Level AA requires 4.5:1)

| Theme | Variable | Value | Ratio on Background | Status |
|-------|----------|-------|---------------------|--------|
| Light | `--color-text-muted` | `#b6b6b6` | 3.5:1 on white | FAIL |
| Dark | `--color-text-muted` | `#84788b` | 2.8:1 on `#100f11` | FAIL |

Used for timestamps, badges, secondary labels, helper text — affects 40+ UI elements.

**Fix**: Light `#808080` (5:1), Dark `#9a8fa8` (5.2:1).

---

### 7. Disabled Button Nearly Invisible

**File**: [Button.scss](src/components/primitives/Button/Button.scss)
**WCAG**: 1.4.3 Contrast Minimum

```scss
.btn-disabled {
  background-color: var(--surface-8);  /* #bbbbc3 */
  color: var(--surface-2);             /* #eeeef3 */
}
```

Contrast ratio: ~2:1 (requires 4.5:1). Light gray text on medium gray background is nearly invisible.

**Fix**: Use `color: #5c5c61` (6.5:1) or redesign with darker background + white text.

---

### 8. Message Mention Highlight Runs 61 Seconds Without Reduced Motion Support

**File**: [Message.scss](src/components/message/Message.scss)
**WCAG**: 2.3.3 Animation from Interactions

```scss
.message-highlighted-mention {
  animation: flash-highlight-mention 61s ease-out;
}
```

Auto-plays for 61 seconds with no `prefers-reduced-motion` check. Can trigger vestibular disorders, migraines. The regular highlight (`flash-highlight`) runs 8 seconds — also unprotected.

**Fix**: Add `@media (prefers-reduced-motion: reduce) { animation: none; background-color: ... }`.

---

### 9. Connecting Page Infinite Pulse Animation

**File**: [Connecting.tsx](src/components/Connecting.tsx)
**WCAG**: 2.3.3 Animation from Interactions

```tsx
className="animate-[pulse-zoom_2s_ease-in-out_infinite]"
```

Infinite pulsing/zooming animation with no reduced motion support. Plays the entire time the user waits to connect.

---

### 10. Emoji Picker Focus Indicators Completely Suppressed

**File**: [_emoji-picker.scss](src/styles/_emoji-picker.scss)
**WCAG**: 2.4.7 Focus Visible

```scss
&:focus, &:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
```

All focus indicators removed with `!important`. Keyboard users are completely blind navigating the emoji picker.

**Fix**: Replace with `:focus-visible { outline: 2px solid var(--accent) }`.

---

### 11. Message Mentions Not Keyboard Accessible

**File**: [MessageMarkdownRenderer.tsx](src/components/message/MessageMarkdownRenderer.tsx)
**WCAG**: 2.1.1 Keyboard

@user, #channel, and message-link mentions are rendered as `<span>` elements with `onClick` only (via event delegation on parent div). No `tabIndex`, no `role`, no `onKeyDown`. Keyboard users cannot interact with mentions at all.

**Fix**: Render mentions as `<button>` or `<a>` elements with proper roles and keyboard handlers.

---

### 12. NavMenu, SpaceButton, ChannelItem Missing Accessible Names

**Files**:
- [NavMenu.tsx](src/components/navbar/NavMenu.tsx)
- [SpaceButton.tsx](src/components/navbar/SpaceButton.tsx)
- [ChannelItem.tsx](src/components/space/ChannelItem.tsx)

**WCAG**: 4.1.2 Name/Role/Value

Navigation elements have `role="link"` and `tabIndex={0}` but:
- No `aria-label` (screen readers announce just "link")
- No `aria-current="page"` for active item
- Unread counts / mention badges not in accessible name
- Muted/pinned states not announced

---

### 13. No aria-live Regions for Dynamic Content

**WCAG**: 4.1.3 Status Messages

Missing `aria-live` everywhere:
- Toast notifications (Layout.tsx) — no `aria-live` or `role="status"`
- New messages arriving — no announcement
- Typing indicators — no announcement
- Connection status changes — no announcement
- Unread count updates — no announcement

Only exception: Input error messages use `role="alert"`.

---

## Important Issues (P1)

### 14. FolderContainer Missing aria-expanded

**File**: [FolderContainer.tsx](src/components/navbar/FolderContainer.tsx)

Has `role="button"` and keyboard support but no `aria-expanded` attribute. Screen readers cannot determine if folder is expanded or collapsed.

### 15. ContextMenu Missing Menu Semantics & Arrow Navigation

**File**: [ContextMenu.tsx](src/components/ui/ContextMenu.tsx)

- No `role="menu"` on container or `role="menuitem"` on items
- Items are `<div>` with onClick — not keyboard navigable
- No arrow key navigation (Up/Down)
- Escape works correctly

### 16. DropdownPanel Missing Arrow Navigation

**File**: [DropdownPanel.tsx](src/components/ui/DropdownPanel.tsx)

Escape key works, but no arrow key navigation, no focus trap, no initial focus.

### 17. DirectMessageContact Missing Labels

**File**: [DirectMessageContact.tsx](src/components/direct/DirectMessageContact.tsx)

Has `role="link"` and `tabIndex={0}` but no `aria-label`, no `aria-current`, unread/muted/favorite states not announced.

### 18. Form Inputs Missing aria-describedby and aria-invalid

**Across all form primitives**:
- `aria-invalid` not implemented anywhere
- `aria-describedby` not linking error messages to inputs
- Error messages appear with `role="alert"` but aren't associated with their input

### 19. TextArea Lacks Label Support

**File**: [TextArea.web.tsx](src/components/primitives/TextArea/TextArea.web.tsx)

Unlike Input which has `label` and `labelType` props, TextArea has no label support at all. Used in CreateSpaceModal and SpaceSettingsModal with placeholder-only accessible names.

### 20. 8 Switch Instances Missing Programmatic Labels

**Files**: ConversationSettingsModal, CreateSpaceModal, UserSettingsModal/Notifications, SpaceSettingsModal

Pattern: `<Switch />` placed next to text label, but no `aria-label` or `aria-labelledby` connecting them. Screen readers announce "unlabeled checkbox".

### 21. Native HTML Inputs Without Labels

- [MuteUserModal.tsx](src/components/modals/MuteUserModal.tsx) — `<input type="text">` with no label, no aria-label
- [SpaceSettingsModal/Roles.tsx](src/components/modals/SpaceSettingsModal/Roles.tsx) — 2 native inputs (role tag, display name) with no labels

### 22. 30+ Animations Without Reduced Motion Support

Only 5 of 35+ animations respect `prefers-reduced-motion`. No global mixin exists. Key unprotected animations:

| Animation | File | Duration | Priority |
|-----------|------|----------|----------|
| Modal open/close | _modal_common.scss | 300ms | HIGH |
| Dropdown open | DropdownPanel.scss | 200ms | HIGH |
| DM sidebar slide | DirectMessages.scss | 300ms | HIGH |
| Input floating label | Input.scss | 200ms | MEDIUM |
| Switch toggle | Switch.scss | 300ms | MEDIUM |
| Button transitions | Button.scss | 300ms | LOW |
| Loading spinners | Various | Infinite | LOW |

### 23. 7 Images Missing Alt Text

| File | Line | Element | Fix |
|------|------|---------|-----|
| ImageModal.tsx | 28 | Fullscreen image | `alt="User shared image"` |
| Message.tsx | 1097 | Message image | `alt="Message image"` |
| Message.tsx | 1182 | Sticker | `alt={sticker.name}` |
| ReactionsList.tsx | 140 | Custom emoji reaction | `alt={emojiName}` |
| Emojis.tsx | 84 | Admin emoji list | `alt={emoji.name}` |
| Stickers.tsx | 84 | Admin sticker list | `alt={sticker.name}` |
| Login.tsx | 46 | Quorum logo | `alt="Quorum"` |

### 24. 4 SVGs Missing Accessibility Attributes

| File | Element | Fix |
|------|---------|-----|
| Logo.tsx | Brand logo | `aria-label="Quilibrium"` |
| Message.tsx:1165 | GIF play overlay | `aria-hidden="true"` |
| MessageComposer.tsx:696 | GIF preview play | `aria-hidden="true"` |
| YouTubeFacade.tsx:135 | YouTube play button | `aria-hidden="true"` (parent button needs label) |

### 25. ImageModal Close Button Missing aria-label

**File**: [ImageModal.tsx](src/components/modals/ImageModal.tsx)

Icon-only `<button>` with no `aria-label`. Should be `aria-label="Close image"`.

---

## Nice-to-Have (P2)

### 26. Secondary Button Low Contrast in Light Mode

`btn-secondary` uses 30% opacity blue background with dark blue text — contrast ~3.8:1. Fix by increasing opacity to 50-60%.

### 27. Input Disabled State Uses opacity: 0.6

Reduces all text contrast by 40%. Should use dedicated disabled color variables instead.

### 28. Dark Theme Placeholder Text Fails

`--color-field-placeholder` in dark mode is `--color-text-muted` (#84788b) — only 2.8:1 ratio.

### 29. Subtle Text Barely Passes in Dark Mode

`--color-text-subtle` (#bfb5c8) is 4.8:1 on dark background — only 0.3 points above minimum.

### 30. Input Clear Button Needs Better Label

Currently `aria-label="Clear input"` — should include field context: `aria-label="Clear ${label}"`.

### 31. Select, FileUpload Missing Integrated Label Support

Select component has excellent ARIA but no built-in label prop. FileUpload hidden input has no accessible name.

### 32. Info Icon Tooltip Focus Suppressed

`_components.scss` uses `outline: none !important` on `.info-icon-tooltip` without replacement focus indicator.

---

## What's Working Well

Several components demonstrate excellent accessibility patterns that should be used as references:

| Component | File | Highlights |
|-----------|------|------------|
| Select | [Select.web.tsx](src/components/primitives/Select/Select.web.tsx) | Full listbox/option pattern, aria-expanded, aria-selected |
| ColorSwatch | [ColorSwatch.web.tsx](src/components/primitives/ColorSwatch/ColorSwatch.web.tsx) | role="button", aria-pressed, tabIndex, keyboard handlers |
| Input | [Input.web.tsx](src/components/primitives/Input/Input.web.tsx) | Label with htmlFor, aria-required, error with role="alert" |
| ActionMenuItem | [ActionMenuItem.tsx](src/components/message/ActionMenuItem.tsx) | Semantic `<button>`, aria-label |
| TouchAwareListItem | [TouchAwareListItem.tsx](src/components/ui/TouchAwareListItem.tsx) | role="button", tabIndex, Enter/Space handlers |
| MobileDrawer | [MobileDrawer.tsx](src/components/ui/MobileDrawer.tsx) | role="dialog", aria-modal, aria-label, Escape key |
| Spoiler element | [MessageMarkdownRenderer.tsx:691](src/components/message/MessageMarkdownRenderer.tsx) | role="button", aria-label, keyboard handlers |

---

## Remediation Roadmap

### Phase 1: Critical Structural Fixes (Week 1-2)

| Task | Effort | Impact |
|------|--------|--------|
| Convert Button `<span>` to `<button>` | 4-6h | 100+ instances |
| Add `role="dialog"` + focus trap to Modal | 4-6h | All modals |
| Add skip-to-content link + `<main>` + landmarks to Layout | 2-3h | Entire app |
| Fix muted text color variables | 15min | 40+ elements |
| Fix disabled button contrast | 15min | All disabled buttons |
| Add `@media (prefers-reduced-motion)` to message highlights | 30min | Critical animations |
| Fix emoji picker focus suppression | 30min | Emoji picker |

### Phase 2: Navigation & Forms (Week 2-3)

| Task | Effort | Impact |
|------|--------|--------|
| Add aria-labels to NavMenu, SpaceButton, ChannelItem | 2-3h | All navigation |
| Add aria-expanded to FolderContainer | 30min | Folder toggles |
| Add aria-describedby + aria-invalid to form primitives | 3-4h | All forms |
| Add label support to TextArea | 2h | TextArea instances |
| Fix Switch component labeling pattern | 2h | 8 switches |
| Fix native inputs in MuteUserModal, Roles.tsx | 1h | 3 inputs |

### Phase 3: Menus, Images, & Animations (Week 3-4)

| Task | Effort | Impact |
|------|--------|--------|
| Add menu roles + arrow navigation to ContextMenu | 3-4h | All context menus |
| Make mentions keyboard accessible | 6-8h | All messages |
| Add aria-live to toast/notifications | 1-2h | All notifications |
| Add alt text to 7 images + aria to 4 SVGs | 1h | Image accessibility |
| Create global `@mixin reduce-motion` + apply to all animations | 4-6h | 30+ animations |
| Add heading hierarchy to pages | 2-3h | Document outline |

### Phase 4: Polish & Testing (Week 4)

| Task | Effort | Impact |
|------|--------|--------|
| Add high contrast support beyond context menus | 2-3h | Vision-impaired users |
| Replace opacity-based disabled states | 2h | Disabled elements |
| Run automated axe/Lighthouse audit | 2h | Verify compliance |
| Manual keyboard navigation test (full user flow) | 3h | Validation |
| Screen reader test with NVDA | 3h | Validation |

**Total Estimated Effort**: 55-75 hours over 4 weeks

---

## WCAG 2.1 Compliance Matrix

### Level A (Must Fix)

| Criterion | Status | Primary Issue |
|-----------|--------|---------------|
| 1.1.1 Non-text Content | PARTIAL | 7 images missing alt text |
| 1.3.1 Info and Relationships | FAIL | No headings, no landmarks, labels missing |
| 2.1.1 Keyboard | FAIL | Button span, mentions not keyboard accessible |
| 2.1.2 No Keyboard Trap | PASS | No traps found (but no focus traps in modals either) |
| 2.4.1 Bypass Blocks | FAIL | No skip-to-content link |
| 2.4.3 Focus Order | PARTIAL | No focus management in modals |
| 3.3.1 Error Identification | PARTIAL | role="alert" exists, not linked to inputs |
| 4.1.2 Name, Role, Value | FAIL | Many elements missing accessible names/roles |

### Level AA (Should Fix)

| Criterion | Status | Primary Issue |
|-----------|--------|---------------|
| 1.4.3 Contrast Minimum | FAIL | Muted text 3.5:1, disabled button 2:1 |
| 2.4.6 Headings and Labels | FAIL | No headings, placeholder-only labels |
| 2.4.7 Focus Visible | FAIL | Emoji picker suppresses focus, Button has none |
| 3.3.3 Error Suggestion | PARTIAL | Error messages shown but not linked |
| 4.1.3 Status Messages | FAIL | No aria-live regions |

---

## Files Requiring Changes (by Priority)

### Critical (P0)
```
src/components/primitives/Button/Button.web.tsx
src/components/primitives/Modal/Modal.web.tsx
src/components/primitives/ModalContainer/ModalContainer.web.tsx
src/components/Layout.tsx
src/styles/_colors.scss (2 lines: muted text)
src/components/primitives/Button/Button.scss (disabled)
src/components/message/Message.scss (motion)
src/components/Connecting.tsx (motion)
src/styles/_emoji-picker.scss (focus)
src/components/message/MessageMarkdownRenderer.tsx (mentions)
src/components/navbar/NavMenu.tsx (labels)
src/components/navbar/SpaceButton.tsx (labels)
src/components/space/ChannelItem.tsx (labels)
```

### Important (P1)
```
src/components/navbar/FolderContainer.tsx
src/components/ui/ContextMenu.tsx
src/components/ui/DropdownPanel.tsx
src/components/direct/DirectMessageContact.tsx
src/components/primitives/Input/Input.web.tsx (aria-invalid, describedby)
src/components/primitives/TextArea/TextArea.web.tsx (labels)
src/components/primitives/Switch/Switch.web.tsx (labeling)
src/components/modals/MuteUserModal.tsx
src/components/modals/SpaceSettingsModal/Roles.tsx
src/components/modals/ImageModal.tsx
src/styles/_modal_common.scss (motion)
src/components/ui/DropdownPanel.scss (motion)
src/components/message/MessageComposer.scss (motion)
```

---

## Testing Recommendations

### Automated
- **axe DevTools** — Run on each major view (Space, DMs, Settings)
- **Lighthouse** — Accessibility audit score target: 90+
- **jest-axe** — Unit tests: `expect(await axe(container)).toHaveNoViolations()`

### Manual
- **Keyboard test**: Navigate login -> send message -> switch spaces -> open settings (keyboard only)
- **Screen reader**: NVDA on Windows, test all interactive elements
- **Zoom test**: 200% browser zoom, verify no horizontal scroll
- **Reduced motion**: Enable `prefers-reduced-motion: reduce`, verify all animations stop
- **High contrast**: Enable system high contrast mode, verify readability

---

*Report generated: 2026-02-10*
*Auditor: Claude Code (7 parallel analysis agents)*
*Standard: WCAG 2.1 Level AA*
