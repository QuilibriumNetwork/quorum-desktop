# Dropzone Visual Feedback & Style Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix missing drag-active visual feedback on all file upload dropzones and replace the accent-filled empty state with a neutral, transparent style that shows accent only on interaction.

**Architecture:** All CSS changes are centralised in `_modal_common.scss` and `UserProfile.scss`. JS changes add `isDragActive`-driven class toggles and inline overlays to each dropzone component. No changes to upload logic, hooks, or the `FileUpload` primitive.

**Tech Stack:** React, TypeScript, SCSS, Tailwind (for inline overlay utility classes), react-dropzone (`isDragActive` already exposed by all hooks)

---

## File Map

| File | Change |
|---|---|
| `src/styles/_modal_common.scss` | Restyle `.avatar-upload.empty` + add `.drag-active` modifier + add `.modal-banner-editable.empty` SCSS rule |
| `src/components/user/UserProfile.scss` | Add `.drag-active` modifier to `.user-profile-icon-editable` |
| `src/components/modals/SpaceSettingsModal/General.tsx` | Wire `isIconDragActive` + `isBannerDragActive` into JSX for overlay + class toggle |
| `src/components/modals/UserSettingsModal/General.tsx` | Wire `isUserIconDragActive` into JSX for overlay + class toggle |
| `src/components/modals/CreateSpaceModal.tsx` | Wire `isDragActive` into JSX for overlay + class toggle |
| `src/components/user/UserProfileEdit.tsx` | Wire `isDragActive` into className for border highlight |
| `src/components/modals/SpaceSettingsModal/Emojis.tsx` | Add `opacity-70` on button during drag |
| `src/components/modals/SpaceSettingsModal/Stickers.tsx` | Add `opacity-70` on button during drag |

---

## Task 1: Restyle `.avatar-upload.empty` in `_modal_common.scss`

**Files:**
- Modify: `src/styles/_modal_common.scss:652-668`

This replaces the accent-filled empty state with a neutral transparent style and adds the `.drag-active` modifier class. No JS changes in this task.

- [ ] **Step 1: Open `src/styles/_modal_common.scss` and locate the `.avatar-upload` block (around line 637)**

The current `.empty` sub-rule looks like this:

```scss
&.empty {
  border: $s-1 dashed var(--accent-100);
  background-color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);

  .icon {
    font-size: $s-8;
  }

  &:hover {
    background-color: var(--accent-400);
    color: white;
  }
}
```

- [ ] **Step 2: Replace the `.empty` block with the new neutral style + drag-active modifier**

```scss
&.empty {
  border: 2px dashed var(--surface-5);
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
  transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease;

  .icon {
    font-size: $s-8;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &.drag-active {
    border-color: var(--accent);
    background-color: rgb(var(--accent-rgb) / 0.12);
    color: var(--accent);
  }
}
```

- [ ] **Step 3: Verify visually — open Space Settings modal in dev; the empty icon circle should now be transparent with a neutral dashed border, not accent-filled**

- [ ] **Step 4: Commit**

```bash
git add src/styles/_modal_common.scss
git commit -m "style: restyle avatar dropzone empty state — neutral border, transparent bg"
```

---

## Task 2: Add `.modal-banner-editable.empty` SCSS rule + remove inline Tailwind from JSX

**Files:**
- Modify: `src/styles/_modal_common.scss:703-710`
- Modify: `src/components/modals/SpaceSettingsModal/General.tsx` (banner className only — full drag-active wiring comes in Task 5)

The banner empty state currently uses inline Tailwind `border-2 border-dashed border-accent-200` applied in JSX. Move this to SCSS so it follows the same pattern as `.avatar-upload.empty` and can accept the `.drag-active` modifier.

- [ ] **Step 1: Add `.empty` and `.drag-active` modifiers to `.modal-banner-editable` in `_modal_common.scss`**

Find the existing block (around line 703):
```scss
.modal-banner-editable {
  cursor: pointer;
  position: relative;

  &:hover {
    opacity: 0.8;
  }
}
```

Replace with:
```scss
.modal-banner-editable {
  cursor: pointer;
  position: relative;
  transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease;

  &:hover {
    opacity: 0.8;
  }

  &.empty {
    border: 2px dashed var(--surface-5);
    background-color: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-subtle);

    &:hover {
      opacity: 1;
      border-color: var(--accent);
      color: var(--accent);
    }

    &.drag-active {
      border-color: var(--accent);
      background-color: rgb(var(--accent-rgb) / 0.12);
      color: var(--accent);
      opacity: 1;
    }
  }
}
```

- [ ] **Step 2: In `src/components/modals/SpaceSettingsModal/General.tsx`, find the banner container (around line 205)**

Current code:
```tsx
<div
  id="space-banner-tooltip-target"
  className={
    'modal-banner-editable ' +
    (hasBanner ? '' : 'border-2 border-dashed border-accent-200')
  }
  style={hasBanner ? { backgroundImage: bannerImageUrl } : {}}
  {...getBannerRootProps()}
>
```

Replace `className` with (remove the inline Tailwind border classes; the SCSS `.empty` modifier now handles it):
```tsx
<div
  id="space-banner-tooltip-target"
  className={`modal-banner-editable${!hasBanner ? ' empty' : ''}`}
  style={hasBanner ? { backgroundImage: bannerImageUrl } : {}}
  {...getBannerRootProps()}
>
```

- [ ] **Step 3: Verify — open Space Settings, Banner tab. Empty state should now show neutral dashed border with no accent fill**

- [ ] **Step 4: Commit**

```bash
git add src/styles/_modal_common.scss src/components/modals/SpaceSettingsModal/General.tsx
git commit -m "style: migrate banner empty state to SCSS, remove inline Tailwind border classes"
```

---

## Task 3: Wire drag-active feedback for avatar circles — Space Settings icon

**Files:**
- Modify: `src/components/modals/SpaceSettingsModal/General.tsx`

The hook `useSpaceFileUploads` already exposes `isIconDragActive`. We need to:
1. Add `.drag-active` to the container class when dragging
2. Render an icon-only overlay inside the circle during drag

- [ ] **Step 1: In `General.tsx`, find the space icon container (around line 127)**

Current:
```tsx
<div
  id="space-icon-tooltip-target"
  className={`avatar-upload ${!hasIcon ? 'empty' : ''}`}
  style={hasIcon ? { backgroundImage: iconImageUrl } : {}}
  {...getIconRootProps()}
>
  <input {...getIconInputProps()} />
  {!hasIcon && (
    <Icon name="image" size="2xl" className="icon" />
  )}
  ...
</div>
```

Replace with:
```tsx
<div
  id="space-icon-tooltip-target"
  className={`avatar-upload${!hasIcon ? ' empty' : ''}${isIconDragActive ? ' drag-active' : ''}`}
  style={hasIcon ? { backgroundImage: iconImageUrl } : {}}
  {...getIconRootProps()}
>
  <input {...getIconInputProps()} />
  {isIconDragActive ? (
    <Icon name="upload" size="2xl" className="icon" />
  ) : (
    !hasIcon && <Icon name="image" size="2xl" className="icon" />
  )}
  ...
</div>
```

- [ ] **Step 2: Verify — drag a PNG file over the space icon circle in Space Settings; the circle border and icon should shift to accent color with a faint tint**

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/General.tsx
git commit -m "fix: add drag-active visual feedback to space icon dropzone"
```

---

## Task 4: Wire drag-active feedback for banner — Space Settings banner

**Files:**
- Modify: `src/components/modals/SpaceSettingsModal/General.tsx`

The hook exposes `isBannerDragActive`. Add `.drag-active` class + render overlay with icon + label.

- [ ] **Step 1: Find the banner container in `General.tsx` (updated in Task 2, now around line 205)**

Add `.drag-active` class and inner overlay:
```tsx
<div
  id="space-banner-tooltip-target"
  className={`modal-banner-editable${!hasBanner ? ' empty' : ''}${isBannerDragActive ? ' drag-active' : ''}`}
  style={hasBanner ? { backgroundImage: bannerImageUrl } : {}}
  {...getBannerRootProps()}
>
  <input {...getBannerInputProps()} />
  {isBannerDragActive && (
    <div className="flex flex-col items-center gap-1 pointer-events-none">
      <Icon name="upload" size="xl" />
      <span className="text-xs font-medium">{t`Drop here`}</span>
    </div>
  )}
  {hasBanner && !isBannerDragActive && (
    <Tooltip id="space-banner-delete" content={t`Delete this image`} place="top">
      <button
        type="button"
        className="image-upload-delete-btn"
        onClick={(e) => { e.stopPropagation(); markBannerForDeletion(); }}
        aria-label={t`Delete this image`}
      >
        <Icon name="trash" size="sm" />
      </button>
    </Tooltip>
  )}
</div>
```

- [ ] **Step 2: Verify — drag a PNG file over the empty banner area; should show faint accent tint + accent border + upload icon + "Drop here" text centered**

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/General.tsx
git commit -m "fix: add drag-active visual feedback to space banner dropzone"
```

---

## Task 5: Wire drag-active feedback — User Settings avatar

**Files:**
- Modify: `src/components/modals/UserSettingsModal/General.tsx`

The hook `useProfileImage` exposes `isUserIconDragActive`. Same pattern as Task 3.

- [ ] **Step 1: Find the user avatar container in `UserSettingsModal/General.tsx` (around line 82)**

Current:
```tsx
<div
  id="user-icon-tooltip-target"
  className={`avatar-upload ${!hasImage ? 'empty' : ''}`}
  style={hasImage ? { backgroundImage: `url(${getProfileImageUrl()})` } : {}}
  {...getRootProps()}
>
  <input {...getInputProps()} />
  {!hasImage && <Icon name="image" size="2xl" className="icon" />}
  ...
</div>
```

Replace with:
```tsx
<div
  id="user-icon-tooltip-target"
  className={`avatar-upload${!hasImage ? ' empty' : ''}${isUserIconDragActive ? ' drag-active' : ''}`}
  style={hasImage ? { backgroundImage: `url(${getProfileImageUrl()})` } : {}}
  {...getRootProps()}
>
  <input {...getInputProps()} />
  {isUserIconDragActive ? (
    <Icon name="upload" size="2xl" className="icon" />
  ) : (
    !hasImage && <Icon name="image" size="2xl" className="icon" />
  )}
  ...
</div>
```

- [ ] **Step 2: Verify — drag a PNG file over the user avatar circle in User Settings; border and icon shift to accent**

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/UserSettingsModal/General.tsx
git commit -m "fix: add drag-active visual feedback to user avatar dropzone"
```

---

## Task 6: Wire drag-active feedback — Create Space modal icon

**Files:**
- Modify: `src/components/modals/CreateSpaceModal.tsx`

The hook `useFileUpload` exposes `isDragActive`. Same pattern as Task 3.

- [ ] **Step 1: Find the space icon container in `CreateSpaceModal.tsx` (around line 93)**

Current:
```tsx
<div
  id="space-icon-tooltip-target"
  className={`avatar-upload ${!fileData ? 'empty' : ''}`}
  style={...}
  {...getRootProps()}
>
  <input {...getInputProps()} />
  {!fileData && <Icon name="image" size="2xl" className="icon" />}
  ...
</div>
```

Replace with:
```tsx
<div
  id="space-icon-tooltip-target"
  className={`avatar-upload${!fileData ? ' empty' : ''}${isDragActive ? ' drag-active' : ''}`}
  style={...}
  {...getRootProps()}
>
  <input {...getInputProps()} />
  {isDragActive ? (
    <Icon name="upload" size="2xl" className="icon" />
  ) : (
    !fileData && <Icon name="image" size="2xl" className="icon" />
  )}
  ...
</div>
```

- [ ] **Step 2: Verify — drag a PNG file over the icon circle in the Create Space modal; visual feedback appears**

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/CreateSpaceModal.tsx
git commit -m "fix: add drag-active visual feedback to create space icon dropzone"
```

---

## Task 7: Wire drag-active feedback — UserProfileEdit legacy avatar

**Files:**
- Modify: `src/components/user/UserProfile.scss`
- Modify: `src/components/user/UserProfileEdit.tsx`

This is the 48px circle. `isDragActive` is already destructured in `UserProfileEdit.tsx` at line 37 but never used. No overlay — just a border highlight.

- [ ] **Step 1: Add `.drag-active` modifier to `.user-profile-icon-editable` in `UserProfile.scss`**

Find the block (around line 68):
```scss
.user-profile-icon,
.user-profile-icon-editable {
  width: $s-12;
  height: $s-12;
  ...
}
```

Add a new rule below this block:
```scss
.user-profile-icon-editable.drag-active {
  outline: 2px dashed var(--accent);
  outline-offset: 2px;
}
```

(Using `outline` instead of `border` so it doesn't affect the element's box model/layout.)

- [ ] **Step 2: In `UserProfileEdit.tsx`, update the className on the dropzone container (around line 67)**

Current:
```tsx
<div
  className="user-profile-icon-editable"
  {...getRootProps()}
>
```

Replace with:
```tsx
<div
  className={`user-profile-icon-editable${isDragActive ? ' drag-active' : ''}`}
  {...getRootProps()}
>
```

- [ ] **Step 3: Verify — drag a file over the small avatar circle in the inline UserProfileEdit panel; an accent dashed outline appears around it**

- [ ] **Step 4: Commit**

```bash
git add src/components/user/UserProfile.scss src/components/user/UserProfileEdit.tsx
git commit -m "fix: add drag-active border highlight to legacy UserProfileEdit avatar"
```

---

## Task 8: Add drag-active opacity to Emojis + Stickers button dropzones

**Files:**
- Modify: `src/components/modals/SpaceSettingsModal/Emojis.tsx`
- Modify: `src/components/modals/SpaceSettingsModal/Stickers.tsx`

The Space Tag button already does `opacity-70` during drag. Apply the same pattern consistently to Emojis and Stickers. The hooks `useCustomAssets` expose drag state via `getEmojiRootProps` / `getStickerRootProps` — check if `isDragActive` (or per-type booleans) is already returned from the hook.

- [ ] **Step 1: Check what `useCustomAssets` returns for drag state**

Open `src/hooks/business/ui/useCustomAssets.ts` and find what drag-active values are returned. Look for anything like `isEmojiDragActive`, `isStickerDragActive`, or a shared `isDragActive`.

- [ ] **Step 2: In `Emojis.tsx`, add `opacity-70` class on the button div when emoji drag is active**

If the hook returns `isEmojiDragActive`:
```tsx
<div
  className={`btn-secondary${isEmojiDragActive ? ' opacity-70' : ''}`}
  {...getEmojiRootProps()}
>
  <Trans>Upload Emoji</Trans>
  <input {...getEmojiInputProps()} />
</div>
```

If the hook does not currently expose an `isEmojiDragActive`, add it to the hook's return value by destructuring `isDragActive` from the emoji `useDropzone` call and returning it as `isEmojiDragActive`.

- [ ] **Step 3: In `Stickers.tsx`, apply the same pattern**

```tsx
<div
  className={`btn-secondary${isStickerDragActive ? ' opacity-70' : ''}`}
  {...getStickerRootProps()}
>
  <Trans>Upload Sticker</Trans>
  <input {...getStickerInputProps()} />
</div>
```

- [ ] **Step 4: Verify — drag a file over the Upload Emoji and Upload Sticker buttons; they dim slightly**

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/Emojis.tsx src/components/modals/SpaceSettingsModal/Stickers.tsx src/hooks/business/ui/useCustomAssets.ts
git commit -m "fix: add drag-active opacity feedback to emoji and sticker upload buttons"
```

---

## Task 9: Final verification pass

- [ ] **Step 1: Build to check for TypeScript errors**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
yarn lint
```

Expected: no new errors.

- [ ] **Step 3: Manual smoke test — drag a PNG file over each surface and confirm the correct visual state**

| Surface | Expected drag-active state |
|---|---|
| Space icon (Space Settings) | Accent border + faint tint + upload icon |
| Space banner (Space Settings) | Accent border + faint tint + upload icon + "Drop here" text |
| User avatar (User Settings) | Accent border + faint tint + upload icon |
| Space icon (Create Space) | Accent border + faint tint + upload icon |
| Onboarding profile photo | Full-screen overlay (unchanged — existing behavior) |
| UserProfileEdit inline avatar | Accent dashed outline (border only, no overlay) |
| Upload Emoji button | opacity-70 |
| Upload Sticker button | opacity-70 |
| Space Tag Upload Image button | opacity-70 (already worked, verify still works) |
| Paperclip button | No change (correct) |

- [ ] **Step 4: Check empty state across all avatar + banner surfaces with no file uploaded — all should be transparent with neutral dashed border**

- [ ] **Step 5: Update bug report to solved**

Move `.agents/bugs/2026-04-07-missing-drag-feedback-file-uploads.md` to `.agents/bugs/.solved/` and add a resolution note at the bottom.

---

*Created: 2026-04-09*
