# Dropzone Visual Feedback & Style Redesign

**Status:** Approved  
**Created:** 2026-04-09

---

## Overview

Two goals addressed together:

1. **Bug fix:** All dropzone areas currently ignore `isDragActive` — users get no visual feedback when dragging a file over a valid drop target.
2. **Style improvement:** The empty-state avatar/banner dropzones use `var(--accent)` as a background fill, which is visually heavy and overuses the brand color. The resting state should be neutral; accent color should appear only on interaction.

---

## Affected Surfaces

### Group A — Avatar Circles (80×80px)

| Surface | Location |
|---|---|
| Space icon (Space Settings) | `src/components/modals/SpaceSettingsModal/General.tsx` |
| Space icon (Create Space) | `src/components/modals/CreateSpaceModal.tsx` |
| User avatar (User Settings) | `src/components/modals/UserSettingsModal/General.tsx` |
| Onboarding profile photo | `src/components/onboarding/Onboarding.tsx` |

All use `.avatar-upload.empty` from `src/styles/_modal_common.scss`.

### Group B — Banner Rectangle (~300×120px)

| Surface | Location |
|---|---|
| Space banner (Space Settings) | `src/components/modals/SpaceSettingsModal/General.tsx` |

Uses `.modal-banner-editable` + inline Tailwind `border-2 border-dashed border-accent-200`.

### Group C — Legacy Avatar Circle (48×48px)

| Surface | Location |
|---|---|
| User avatar inline edit | `src/components/user/UserProfileEdit.tsx` |

Uses `.user-profile-icon-editable`. Always shows the existing avatar (no blank state). Independent inline `useDropzone` call.

### Group D — Button Dropzones

| Surface | Location |
|---|---|
| Custom emojis | `src/components/modals/SpaceSettingsModal/Emojis.tsx` |
| Custom stickers | `src/components/modals/SpaceSettingsModal/Stickers.tsx` |
| Space tag image | `src/components/modals/SpaceSettingsModal/SpaceTagSettings.tsx` |

These look like normal secondary buttons. No dedicated dropzone area to style. Only minimal drag feedback is appropriate.

### Group E — Paperclip Button (36×36px)

| Surface | Location |
|---|---|
| Message image attachment | `src/components/message/MessageComposer.tsx` |

The dropzone wraps only the small paperclip icon button. No visible drop area exists to highlight. No changes needed.

---

## Design

### Empty State (Groups A + B)

| Property | Value |
|---|---|
| Background | Transparent |
| Border | `2px dashed var(--surface-5)` |
| Icon color | `var(--text-subtle)` |

Transparent background means the dropzone inherits whatever is behind it — modal surface, onboarding background, etc. This avoids the accent-fill problem and works across all screen contexts without special casing.

### Hover State (Groups A + B)

| Property | Value |
|---|---|
| Background | Transparent (unchanged) |
| Border | `2px dashed var(--accent)` |
| Icon color | `var(--accent)` |

Accent appears on intent (hover), confirming interactivity without dominating the resting UI.

### Drag-Active State

**Group A — Avatar circles (80×80px):**  
Icon-only overlay. Text doesn't fit comfortably at 80px.

- Background tint: `var(--accent)` at 12% opacity (implementation: verify `--accent-rgb` exists for `rgba()`; fallback is Tailwind `bg-accent/12` if the CSS variable supports opacity modifiers)
- Border: `2px dashed var(--accent)`
- Centered `upload` icon in `var(--accent)`
- Transition: `150ms ease`

**Group B — Banner rectangle (~300×120px):**  
Localized overlay with icon + text.

- Background tint: `var(--accent)` at 12% opacity
- Border: `2px dashed var(--accent)`
- Centered: upload icon + "Drop here" label in `var(--accent)`
- Transition: `150ms ease`

**Group C — Legacy 48px circle:**  
Border highlight only. Too small for an overlay; not worth the visual noise.

- Border: `2px dashed var(--accent)`
- No overlay, no background change

**Group D — Button dropzones:**  
Match existing space tag pattern: `opacity-70` on the button during drag. Already implemented on space tag; apply consistently to emojis and stickers.

**Group E — Paperclip:**  
No changes.

### Filled State (all groups)

No changes. When an image is present, the dropzone shows the image with the existing hover-reveal delete button. Border and background are removed.

---

## Implementation Notes

### CSS changes — `_modal_common.scss`

The `.avatar-upload.empty` rule currently sets:
```scss
background-color: var(--accent);
border: $s-1 dashed var(--accent-100);
color: rgba(255, 255, 255, 0.6);
&:hover { background-color: var(--accent-400); color: white; }
```

Replace with:
```scss
background-color: transparent;
border: 2px dashed var(--surface-5);
color: var(--text-subtle);
&:hover {
  border-color: var(--accent);
  color: var(--accent);
}
```

Add a drag-active modifier class `.drag-active` (applied via JS):
```scss
&.drag-active {
  border-color: var(--accent);
  background-color: rgba(var(--accent-rgb), 0.12);
  color: var(--accent);
}
```

The banner dropzone currently uses inline Tailwind (`border-2 border-dashed border-accent-200`). Move to a `.modal-banner-editable.empty` SCSS modifier (parallel to `.avatar-upload.empty`) so it follows the same pattern and can respond to drag-active state consistently.

### JS changes — dropzone components

For Groups A and B, each dropzone container needs:
1. The `isDragActive` boolean from its hook
2. A `.drag-active` class toggled on the container when `isDragActive` is true
3. A conditional inner overlay rendered when `isDragActive` is true

For avatar circles, the overlay renders a single centered icon (no text).  
For the banner, the overlay renders an icon + "Drop here" text.

### `FileUpload` primitive — no changes needed

The `FileUpload` primitive already exposes `onDragActiveChange`. The Onboarding screen already uses this correctly. The modal hooks (`useSpaceFileUploads`, `useProfileImage`, `useFileUpload`) use `useDropzone` directly and already expose `isDragActive` — it just needs to be wired into the UI.

### Onboarding screen — no changes

The existing full-screen overlay pattern in `Onboarding.tsx` is intentional and well-designed. The avatar circle's empty state will get the new neutral style (transparent bg, neutral border), but the drag-active behavior stays as the full-screen overlay — the `onDragActiveChange` prop already handles this separately.

### `UserProfileEdit.tsx` — drag-active border only

Apply `2px dashed var(--accent)` border to `.user-profile-icon-editable` when `isDragActive` is true. No overlay. The `isDragActive` variable is already destructured from `useDropzone` in this component — it just needs to be used.

---

## State Summary

```
Empty    → transparent bg, 2px dashed neutral border (surface-5), muted icon
Hover    → transparent bg, 2px dashed accent border, accent icon
Drag     → faint accent bg tint (12%), 2px dashed accent border, accent icon/overlay
Filled   → image shown, no border
```

---

## Out of Scope

- Message composer drag-to-channel (expanding the dropzone to cover the whole channel area) — separate feature, not part of this fix
- Any changes to upload logic, compression, or file validation
- Native/mobile implementations — drag-and-drop is web-only

---

*Created: 2026-04-09*
