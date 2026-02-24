---
type: task
title: Emoji Picker in Message Composer
status: done
complexity: medium
ai_generated: true
reviewed_by: expert-panel
created: 2026-02-24
updated: 2026-02-24
related_issues:
  - "PR #1 - https://github.com/QuilibriumNetwork/quorum-desktop/pull/1"
related_docs: []
related_tasks: []
---

# Emoji Picker in Message Composer

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: expert-panel (Architecture 7/10, Implementation 7/10, Pragmatism 5/10 — revised per recommendations)

**Files**:
- `src/components/message/MessageComposer.tsx:778-788` — Smiley/sticker button
- `src/components/space/Channel.tsx:1122-1152` — Current stickers panel
- `src/components/space/Channel.scss:41-126` — Stickers panel styles
- `src/components/direct/DirectMessage.tsx:847-874` — DM composer usage
- `src/components/message/EmojiPickerDrawer.tsx` — Existing responsive emoji drawer (small screens)
- `src/hooks/business/messages/useEmojiPicker.ts` — Existing emoji picker hook (reactions)
- `src/hooks/business/messages/useMessageComposer.ts` — Message composer hook
- `src/styles/_emoji-picker.scss` — Global emoji picker theming
- `src/components/context/MobileProvider.tsx` — Responsive drawer state management

**Scope**: Web app only (quorum-desktop). The native mobile app (quorum-mobile) will implement this separately later. References to "mobile" below mean small-screen/responsive behavior within this web app.

## What & Why

Currently, the message composer has no way to insert emojis into message text. The smiley icon in Space channels only opens the stickers panel. DMs have no smiley icon at all (`hasStickers={false}`). Users need a convenient way to browse and insert emojis while composing messages, which is a standard messaging feature.

**Goal**: Add emoji insertion to both Space channel and DM composers, leveraging the existing `emoji-picker-react` library (v4.12.0) and emoji theming already in the codebase.

## Context

- **Existing emoji infrastructure**: The project already uses `emoji-picker-react` with `emoji-datasource-apple` for message reactions via `EmojiPickerDrawer` (responsive small-screen drawer) and `useEmojiPicker` hook. Global theming is in `_emoji-picker.scss`.
- **Stickers panel**: Currently rendered inline in `Channel.tsx` as a standalone panel (300x400px, positioned fixed, bottom 80px) with a backdrop overlay. Opened via the smiley icon in `MessageComposer`.
- **DM composer**: Passes `hasStickers={false}` and `onShowStickers={() => {}}`, so no smiley icon appears.
- **Custom emojis**: Spaces have `space.emojis` already passed to components as `customEmoji`. These should be available in the emoji picker.
- **Community PR #1**: A community contributor attempted this feature but the implementation was incomplete — channels only, hardcoded dark theme styles, no stickers integration, no DM support. The basic approach (state + click-outside handler + EmojiPicker component) is valid.
- **Dual editor modes**: `MessageComposer` runs in two modes controlled by `ENABLE_MENTION_PILLS` flag — plain `<TextArea>` mode and `contentEditable` mode with mention pill `<span>` nodes. Emoji insertion must handle both.

## Prerequisites

- [ ] Branch created from `develop` (`feat/emojis-in-messages`)
- [ ] Review existing emoji picker configuration in `EmojiPickerDrawer.tsx`
- [ ] Review stickers panel implementation in `Channel.tsx:1122-1152` and `Channel.scss:41-126`
- [ ] Understand the two editor modes in `MessageComposer.tsx` (`ENABLE_MENTION_PILLS` flag)

## Architecture Decisions (from expert panel review)

1. **No new component extraction** — Add emoji tab directly to the existing stickers panel JSX in `Channel.tsx`. The panel is ~30 lines; tabs add ~25 more. The DM uses a separate emoji-only panel, so a shared component isn't reused enough to justify extraction.

2. **No new props on `MessageComposer`** — Repurpose existing `hasStickers`/`onShowStickers` for DMs instead of adding `hasEmojis`/`onShowEmojis`. The smiley button already exists; DMs just need to pass `hasStickers={true}` with an appropriate callback.

3. **Panel state stays in view components** — Don't add emoji state to `useMessageComposer`. The hook already returns `setPendingMessage`; callers append emoji directly. Panel visibility is UI state belonging in `Channel.tsx` / `DirectMessage.tsx`.

4. **Lazy-load `EmojiPicker`** — Use `React.lazy(() => import('emoji-picker-react'))` with `<Suspense>` since the emoji bundle is large and shouldn't load on every channel init.

5. **ContentEditable insertion** — When `ENABLE_MENTION_PILLS` is active, use `document.execCommand('insertText', false, emoji)` + `handleEditorInput()` (matching the existing paste handler pattern at `MessageComposer.tsx:256`), not `setPendingMessage(prev + emoji)`.

6. **Emoji picker stays open after selection** — Users can pick multiple emojis without reopening. Close on: outside click, Escape key, or sticker selection (stickers send immediately). Panel does not close when switching tabs.

7. **Type the MobileProvider data** — Replace `data?: any` in the emoji drawer state with a typed interface to prevent callback contamination between reaction and composer contexts.

## Implementation

### Step 1: Add Emoji Tab to Stickers Panel in `Channel.tsx`

- [ ] **Add tab state to `Channel.tsx`**
  - Add `const [panelTab, setPanelTab] = useState<'emojis' | 'stickers'>('emojis')` in `Channel.tsx`
  - Done when: State exists, default tab is emojis

- [ ] **Lazy-load EmojiPicker**
  - Add `const EmojiPicker = React.lazy(() => import('emoji-picker-react'))` at module level
  - Wrap usage in `<Suspense fallback={<div className="emoji-picker-loading" />}>`
  - Done when: EmojiPicker loads on demand, not on channel init

- [ ] **Expand the existing stickers panel** (lines 1122-1152 in `Channel.tsx`)
  - Add tab navigation bar (two buttons: "Emojis" / "Stickers") above the content area
  - Conditionally render either `<EmojiPicker>` (with existing config from `EmojiPickerDrawer`: dark theme, apple emoji set, frequent suggestions, skin tone in preview) or the existing sticker grid based on `panelTab`
  - Include custom emojis from `space.emojis` using the `customEmojis` transform from `useEmojiPicker.ts`
  - Wire `onEmojiClick` to insert emoji into composer text (see emoji insertion logic below)
  - Add Escape key handler to close panel
  - Add styles for tabs in `Channel.scss` (consistent with app theming)
  - Done when: Smiley button opens tabbed panel, can switch between emojis and stickers
  - Verify: Open panel → default shows emojis → switch to stickers → stickers grid appears → switch back → emoji picker appears

- [ ] **Emoji insertion logic** (handle both editor modes)
  - **TextArea mode** (`ENABLE_MENTION_PILLS` off): `composer.setPendingMessage(prev => prev + emoji)` — appends to end
  - **ContentEditable mode** (`ENABLE_MENTION_PILLS` on): Use `document.execCommand('insertText', false, emoji)` followed by `handleEditorInput()` — matching the paste handler pattern at `MessageComposer.tsx:256`. This preserves mention pill DOM structure.
  - Done when: Emoji inserts correctly in both editor modes
  - Verify: Type a message → pick emoji → emoji appears at end. With mention pills enabled: type `@user` (creates pill) → pick emoji → pill is preserved, emoji inserted after it.

### Step 2: Emoji Picker for Direct Messages

- [ ] **Update `DirectMessage.tsx`** — Wire emoji picker using existing props
  - Change `hasStickers={false}` to `hasStickers={true}` on the `MessageComposer`
  - Change `onShowStickers={() => {}}` to toggle a local `showEmojiPanel` state
  - Add `const [showEmojiPanel, setShowEmojiPanel] = useState(false)`
  - Render the lazy-loaded `<EmojiPicker>` in a positioned panel (similar positioning to Channel stickers panel but without the stickers tab) when `showEmojiPanel` is true
  - Add backdrop + click-outside handler to close
  - Add Escape key handler to close
  - Wire `onEmojiClick` to insert emoji (same dual-mode logic as Step 1)
  - Update the button tooltip from "add sticker" to "add emoji" (or a generic label)
  - Done when: DM composer shows smiley icon, clicking opens emoji-only picker, selecting inserts into text
  - Verify: Open DM → smiley icon visible → click → emoji picker opens (no stickers tab) → pick emoji → appears in message text → click outside → closes

### Step 3: Small-Screen Responsive Support

**Note**: "Mobile" here means small web viewports using `isMobile` / `useResponsiveLayout()`, not the quorum-mobile native app.

- [ ] **Type the MobileProvider emoji data** (`src/components/context/MobileProvider.tsx`)
  - Replace `data?: any` in the emoji drawer state with a typed interface:
    ```typescript
    interface EmojiDrawerData {
      onEmojiClick: (emoji: string) => void;
      customEmojis: CustomEmoji[];
    }
    ```
  - Done when: `data` field is typed, existing reaction usage updated to match

- [ ] **Wire small-screen emoji drawer from composer**
  - In `Channel.tsx`: When `isMobile`, the smiley button calls `openMobileEmojiDrawer({ onEmojiClick: (e) => composer.setPendingMessage(prev => prev + e), customEmojis })` instead of opening the floating panel
  - In `DirectMessage.tsx`: Same pattern — use `openMobileEmojiDrawer` when `isMobile`
  - The parent component (`Channel.tsx` / `DirectMessage.tsx`) calls `useMobile()` and dispatches — `MessageComposer` itself does NOT depend on `MobileContext`
  - Done when: On small viewports, tapping smiley opens the bottom drawer instead of the floating panel
  - Verify: Resize to mobile viewport → tap smiley → EmojiPickerDrawer opens as bottom sheet → pick emoji → inserts into text

### Step 4: Polish

- [ ] **Custom emojis in picker**
  - Space custom emojis (`space.emojis`) appear in the emoji picker's custom section
  - Reuse the `customEmojis` transform from `useEmojiPicker.ts` (converts `Emoji[]` to `CustomEmoji[]`)
  - Done when: Custom space emojis appear and can be selected
  - Verify: Space with custom emojis shows them in picker, selecting inserts the emoji

- [ ] **Escape-to-close and focus return**
  - Escape closes the panel and returns focus to the composer textarea
  - Done when: Keyboard close works in both Channel and DM contexts

## Verification

✅ **Space channel — emoji insertion**
   - Open a Space channel → click smiley icon → "Emojis" tab is active → select an emoji → emoji appears in message text → picker stays open → select another → send message → emojis render in message

✅ **Space channel — stickers still work**
   - Open a Space channel → click smiley icon → switch to "Stickers" tab → click a sticker → sticker message is sent immediately

✅ **Space channel — custom emojis**
   - In a Space with custom emojis → open picker → custom emojis appear in picker → can select and insert

✅ **DM — emoji insertion**
   - Open a DM conversation → smiley icon is visible → click it → emoji picker opens (no stickers tab) → select emoji → appears in message text

✅ **ContentEditable mode (mention pills)**
   - With `ENABLE_MENTION_PILLS` on → type `@user` to create a pill → open emoji picker → select emoji → pill preserved, emoji inserted correctly

✅ **Panel close behavior**
   - Click outside panel → closes
   - Press Escape → closes
   - Select emoji → stays open (multi-emoji support)
   - Switch tabs → stays open

✅ **Small-screen responsive**
   - On small viewport → tap smiley → EmojiPickerDrawer opens as bottom sheet → select emoji → inserts into message

✅ **Lazy loading**
   - Navigate to channel → emoji bundle NOT loaded → click smiley → emoji picker loads and renders

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **No regressions**
   - Existing message reactions still work
   - Sticker sending still work
   - Message submission (Enter key) still works
   - File upload still works
   - Mention pills still work

## Definition of Done

- [ ] Emoji picker available in Space channel composer (tabbed with stickers)
- [ ] Emoji picker available in DM composer (emoji-only)
- [ ] Small-screen support via EmojiPickerDrawer
- [ ] Custom space emojis included in picker
- [ ] Emoji picker lazy-loaded (not bundled on channel init)
- [ ] ContentEditable insertion works (mention pills preserved)
- [ ] Close on outside click / Escape
- [ ] Picker stays open for multi-emoji selection
- [ ] MobileProvider data typed (no `any`)
- [ ] Existing sticker and reaction features not broken
- [ ] TypeScript passes
- [ ] Manual testing on desktop and small viewports
- [ ] No console errors

---

_Created: 2026-02-24_
_Updated: 2026-02-24 — Revised per expert panel review (simplified architecture, added lazy-loading, contentEditable handling, typed MobileProvider)_
