---
type: spec
title: Text + Image Combined Message
status: approved
created: 2026-04-09
updated: 2026-04-09
---

# Text + Image Combined Message

## Problem

When a user attaches an image and writes text in the composer, hitting send creates two separate messages: one `PostMessage` (text) and one `EmbedMessage` (image). This is poor UX — the intent is a single message with both content types together, like Discord or iMessage.

Additionally, a latent bug exists today: if the user hits send while image processing is still running, `processedImage` is `undefined` and the image is silently dropped. Only the text sends.

## Solution

Merge the text and image into a single `PostMessage` by embedding the image in the existing `embeddedMedia` field. Fix the send-during-processing bug as part of the same change.

## Scope

### In scope
- Combined text + image as a single `PostMessage`
- Image rendered below the text in the message
- Click-to-modal (lightbox) on the inline image, same as `EmbedMessage` today
- Thumbnail displayed inline, full image opened in modal
- Blocking send while image is still processing (fixes existing bug)
- YouTube thumbnails and image attachments coexisting in `embeddedMedia` on the same message

### Out of scope
- Retiring `EmbedMessage` — image-only messages continue using it unchanged
- Multiple image attachments per message
- Edit message support for combined messages
- Mobile changes (mobile ignores unknown `embeddedMedia` entries — backwards compatible)

## Protocol

No changes to `quorum-shared` are required. `PostMessage.embeddedMedia` is already typed as `Array<{ type: string; key: string; data: string; mimeType: string }>`. The `type` field is a plain `string`, so new values are valid without a schema change.

Two new `type` values are introduced by convention:

| type | description |
|------|-------------|
| `'image-thumbnail'` | Resized/compressed version for inline display |
| `'image'` | Full-size version opened in the lightbox modal |

Both entries share the same `key` (a UUID generated at send time), allowing the renderer to associate them.

### Wire format example

```json
{
  "type": "post",
  "text": "Check this out",
  "embeddedMedia": [
    {
      "type": "image-thumbnail",
      "key": "a1b2c3d4-...",
      "data": "<base64, no data URI prefix>",
      "mimeType": "image/jpeg"
    },
    {
      "type": "image",
      "key": "a1b2c3d4-...",
      "data": "<base64, no data URI prefix>",
      "mimeType": "image/jpeg"
    }
  ]
}
```

If `processedImage.thumbnail` is unavailable (small images may not generate one), only the `'image'` entry is included and is used for both display and modal.

## Backwards Compatibility

Old clients ignore unknown `embeddedMedia` entries and render only the `text`. The image is invisible to them. This is the same accepted trade-off as YouTube thumbnails — a plain text message is better than a crash or broken render.

## Send Path

Changes are confined to `useMessageComposer.ts`.

### Guard: block send during image processing

Add `isProcessingImage` as a blocking condition in `submitMessage`. If true, return early. This fixes the existing silent-drop bug and ensures the combined send always has a fully processed image ready.

The existing "Processing image..." callout in the composer already communicates this state to the user — no new UX needed.

### Combined send logic

```
if (isProcessingImage): return early — send blocked

if (pendingMessage && processedImage):
  - Generate UUID key
  - Encode processedImage.full as base64 → embeddedMedia entry { type: 'image', key, data, mimeType }
  - If processedImage.thumbnail exists → additional entry { type: 'image-thumbnail', key, data, mimeType }
  - Run extractStandaloneYouTubeVideoIds(pendingMessage) as today
  - Merge YouTube embeddedMedia entries (if any) with image entries
  - Call onSubmitMessage({ type: 'post', text: pendingMessage, embeddedMedia }, inReplyTo?.messageId)

if (pendingMessage only):
  → existing text path, unchanged

if (processedImage only):
  → existing EmbedMessage path, unchanged
```

After send: clear both `pendingMessage` and `processedImage` as today.

## Rendering

Changes are confined to `Message.tsx`.

After rendering the text tokens for a `PostMessage`, check `content.embeddedMedia` for entries with `type: 'image'` or `'image-thumbnail'`. For each unique key found:

1. Prefer `'image-thumbnail'` src for the inline `<img>` display; fall back to `'image'` if no thumbnail entry exists
2. Use `'image'` src for the lightbox modal (same modal used by `EmbedMessage` today)
3. Image is rendered below the text
4. Image is clickable — opens lightbox with full-size image
5. `onError` on the `<img>` hides it gracefully (no broken image icon) — handles corrupt/truncated base64

The `getEmbeddedMediaSrc` utility already handles the `data:` URI construction — reuse it.

## Composer UX

One change to `MessageComposer.tsx`:

- Send button is disabled when `isProcessingImage` is true (in addition to existing `isOverLimit` condition)

No other composer changes. Attachment flow, preview, remove-image button, and drag-and-drop are all unchanged.

## Edge Cases

| Case | Behavior |
|------|----------|
| Text + image, thumbnail unavailable | Only `'image'` entry sent; used for both display and modal |
| Text + image + YouTube URL | All coexist in `embeddedMedia`; one message |
| Image only (no text) | Existing `EmbedMessage` path, unchanged |
| Text only (no image) | Existing text path, unchanged |
| Send during image processing | Send button blocked; nothing happens |
| Corrupt/truncated base64 | `onError` on `<img>` hides image gracefully |
| Reply-to with text + image | Single combined message with `repliesToMessageId` set |
| Old client receives combined message | Sees text only; image invisible — accepted degradation |

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `src/hooks/business/messages/useMessageComposer.ts` | quorum-desktop | Merge text+image into single PostMessage; block send during processing |
| `src/components/message/Message.tsx` | quorum-desktop | Render `type: 'image'` / `'image-thumbnail'` entries from embeddedMedia |
| `src/components/message/MessageComposer.tsx` | quorum-desktop | Disable send button when `isProcessingImage` is true |

---

*Created: 2026-04-09 | Updated: 2026-04-09*
