---
type: bug
title: "No visual feedback when dragging files onto dropzone areas"
status: open
priority: low
ai_generated: true
created: 2026-04-07
updated: 2026-04-07
---

# No visual feedback when dragging files onto dropzone areas

> **Warning: AI-Generated**: May contain errors. Verify before use.

## Symptoms

When dragging a file (e.g. an image from the file explorer) onto a dropzone area in the app, there is no visual feedback indicating where to drop it. The drop itself works correctly, but the user has no way of knowing they are hovering over a valid drop target.

**Observed in**: Space avatar upload (Space Settings > Account tab). Likely affects all dropzone areas.

**Expected behavior**: A visual indicator (highlighted border, overlay with "Drop here" text, background color change) should appear when a file is dragged over a valid drop area.

## Root Cause

The `useDropzone` hook from `react-dropzone` exposes an `isDragActive` boolean that is `true` when a file is being dragged over the dropzone. However, the UI components do not use this flag to show visual feedback.

For example, in `Account.tsx:163`, `isAvatarDragActive` is only used to hide the tooltip during drag, not to show a drop indicator:

```tsx
{!isAvatarUploading && !isAvatarDragActive && !showImage && (
  <ReactTooltip ... />
)}
```

## Affected Areas

All hooks that use `useDropzone` expose `isDragActive` but it is likely underused in the UI:

| Hook | File | UI Component |
|------|------|--------------|
| `useSpaceProfile` | `src/hooks/business/spaces/useSpaceProfile.ts:79` | Space avatar upload |
| `useProfileImage` | `src/hooks/business/user/useProfileImage.ts:41` | User profile image |
| `useMessageComposer` | `src/hooks/business/messages/useMessageComposer.ts:76` | Chat file attachments |
| `useFileUpload` | `src/hooks/business/ui/useFileUpload.ts:48` | Generic file upload |
| `useSpaceTag` | `src/hooks/business/spaces/useSpaceTag.ts:43` | Space tag image |
| `useCustomAssets` | `src/hooks/business/ui/useCustomAssets.ts:80` | Custom asset uploads |
| `useSpaceFileUploads` | `src/hooks/business/ui/useSpaceFileUploads.ts:65` | Space file uploads |
| `useWebFileUpload` | `src/hooks/business/user/useWebFileUpload.ts:21` | Web file upload |

## Solution

For each dropzone component, add a visual state change when `isDragActive` is `true`. Common patterns:

1. **Border highlight**: Add a dashed border or change border color (e.g. `border-2 border-dashed border-blue-400`)
2. **Overlay**: Show a semi-transparent overlay with "Drop file here" text
3. **Background change**: Subtle background color shift

Example approach for the avatar area:

```tsx
<div
  {...getRootProps()}
  className={clsx(
    'avatar-dropzone',
    isAvatarDragActive && 'ring-2 ring-blue-400 ring-offset-2 bg-blue-50/10'
  )}
>
```

## Prevention

When implementing new file upload areas, always use the `isDragActive` state from `useDropzone` to provide visual feedback during drag operations.

---

*Created: 2026-04-07*
