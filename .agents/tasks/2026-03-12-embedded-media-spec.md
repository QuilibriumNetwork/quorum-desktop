---
type: spec
title: Embedded Media in PostMessage + YouTube Facade Privacy Fix
status: approved
created: 2026-03-11
updated: 2026-03-12
github: https://github.com/QuilibriumNetwork/quorum-desktop/issues/125
---

# Embedded Media in PostMessage + YouTube Facade Privacy Fix

## Problem

When a Quorum user sends a message containing a YouTube URL, every **receiver** fetches the video thumbnail directly from YouTube's CDN (`https://i.ytimg.com/vi/{videoId}/...`). This means:

- YouTube's servers see the receiver's IP address
- YouTube knows what video the receiver viewed and when
- The receiver never asked to contact YouTube — they just opened a chat

This is a privacy violation: a third party (YouTube/Google) can correlate receiver IP addresses with video IDs and timestamps, enabling deanonymization attacks.

A YouTube-specific fix (`youtubeThumbnails` field) would solve this narrowly, but the underlying need — attaching binary media blobs to a text message — is generic. The same mechanism will be needed for future features like image captions and link previews.

## Solution

Introduce a generic `embeddedMedia` attachment system on `PostMessage`, then plug YouTube thumbnails into it as the first consumer. This solves the privacy problem and lays the foundation for future media embedding without repeated protocol changes.

The facade UX (thumbnail shown → click to load iframe) is preserved. The only change is where the thumbnail image comes from: embedded data instead of YouTube's CDN.

## Privacy Model

| Action | Who contacts YouTube | User's choice? |
|--------|---------------------|----------------|
| Thumbnail displayed | Sender (at send time) | Yes — they shared the link |
| Video plays | Receiver (on click) | Yes — they clicked play |
| Thumbnail displayed (old behavior) | Receiver (automatically) | ❌ No |

## Scope

### In scope
- Generic `embeddedMedia` field on `PostMessage` in quorum-shared
- Sender-side YouTube thumbnail fetch (silent, before send)
- Plugging YouTube thumbnails into `embeddedMedia`
- Reworking `YouTubeFacade` to use embedded data when present
- Graceful degradation when data is absent (plain clickable link, no external request)

### Out of scope
- Inline YouTube URLs (mixed with other text) — remain plain clickable links
- Image + caption messages as a composed UI feature (the protocol supports it; the composer UI does not, yet)
- GIF library integration
- A "paranoid mode" setting (future work per Cassie's security note)

## quorum-shared Requirement

`PostMessage` is **canonically defined in `@quilibrium/quorum-shared`** (`src/types/message.ts`), not in `quorum-desktop`. The `embeddedMedia` field must be added there first.

- **During development:** `yarn link` against the local `d:\GitHub\Quilibrium\quorum-shared` repo
- **For release:** publish a new quorum-shared version, bump `package.json` in quorum-desktop (currently `"@quilibrium/quorum-shared": "2.1.0-2"`)
- **Mobile:** inherits the same type automatically; unknown fields are ignored — backwards compatible

Do **not** add the field only to `quorum-desktop/src/api/quorumApi.ts` — that creates a type divergence between platforms.

## Protocol Change

`PostMessage` in `@quilibrium/quorum-shared/src/types/message.ts` gains one new optional field:

```typescript
embeddedMedia?: Array<{
  type: string;   // e.g. 'youtube-thumbnail', 'image', 'link-preview'
  key: string;    // lookup key — for YouTube: the 11-char video ID
  data: string;   // base64-encoded binary data (no data URI prefix)
  mimeType: string; // e.g. 'image/jpeg'
}>;
```

### Design rationale

- `type` — discriminator for future consumers; keeps rendering logic extensible
- `key` — how the renderer looks up the right blob for a given URL/token in the text
- `data` — raw base64, no `data:...;base64,` prefix (added at render time to keep the stored payload clean)
- `mimeType` — needed for correct `data:` URI construction and future non-JPEG media

### YouTube thumbnail entry example

```typescript
{
  type: 'youtube-thumbnail',
  key: 'dQw4w9WgXcQ',       // video ID
  data: '/9j/4AAQSkZJRgAB...', // base64 JPEG, no prefix
  mimeType: 'image/jpeg',
}
```

## Backwards Compatibility

The field is optional. Old clients ignore it. New clients receiving old messages (no `embeddedMedia`) fall back to plain clickable links — no external requests made. This is a deliberate privacy-safe degradation: a plain link is better than silently contacting YouTube on the receiver's behalf.

**UX trade-off:** Historical messages will lose the facade thumbnail and show plain YouTube links on new clients. This is accepted as the correct privacy trade-off for a beta product.

## Standalone URL Definition

A YouTube URL is "standalone" when the entire trimmed content of a line is exactly that URL and nothing else:

```typescript
const lines = text.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (isYouTubeURL(trimmed)) {
    // standalone — fetch thumbnail for this video ID
  }
}
```

A URL followed by a trailing space, or mixed with other text, is **not** standalone and becomes a plain clickable link.

## Thumbnail Quality

Use **`hqdefault`** (480×360px JPEG):
- YouTube embeds in Quorum are capped at **560px wide** (height ~315px at 16:9)
- `hqdefault` is sufficient for this display size
- `maxresdefault` (1280×720) is oversized and not always available
- Estimated payload per thumbnail: ~20–40KB image → ~27–55KB base64

The existing quality-fallback waterfall (`maxres → hq → mq → default`) in `YouTubeFacade` is **bypassed entirely** when embedded data is present.

## Payload Size

- Per thumbnail: ~27–55 KB base64
- Cap at **3 standalone YouTube URLs per message** — first 3 in document order, extras become plain links
- Total worst-case addition per message: ~165 KB — acceptable for occasional use

## Fetch Behaviour

- Method: standard `fetch()` in the Electron renderer process
- Target: `https://i.ytimg.com/vi/{videoId}/hqdefault.jpg`
- Timeout: 5 seconds (`AbortController`)
- CSP: no changes needed — `index.html` already has `img-src * data: blob:` and `default-src *`
- On any failure (network error, timeout, non-200, bad blob): return `null`, omit silently

## Sending Flow

1. User submits message in composer
2. Scan text for standalone YouTube URLs → extract video IDs (new `extractStandaloneYouTubeVideoIds` utility)
3. Cap at 3 video IDs
4. Fetch `hqdefault` thumbnails in parallel with 5s timeout
5. Successful fetches → build `embeddedMedia` entries (`type: 'youtube-thumbnail'`, `key: videoId`, `data: base64`, `mimeType: 'image/jpeg'`)
6. Failed fetches → omit silently
7. Attach `embeddedMedia` array to `PostMessage` if non-empty
8. Send

## Receiving / Rendering Flow

### Helper: `getEmbeddedMedia(content, type, key)`

A small utility that safely looks up an entry in `embeddedMedia` given a type and key:

```typescript
const getEmbeddedMedia = (
  content: MessageContent,
  type: string,
  key: string
): string | null => {
  if (!('embeddedMedia' in content) || !content.embeddedMedia) return null;
  const entry = content.embeddedMedia.find(
    (m) => m.type === type && m.key === key
  );
  return entry ? `data:${entry.mimeType};base64,${entry.data}` : null;
};
```

This is the single type-safe access point — avoids scattered casting throughout the rendering code.

### In `useMessageFormatting.ts`
Extend the `youtube` token to carry a resolved data URI (or null):

```typescript
// Before
{ type: 'youtube', key: string, videoId: string }

// After
{ type: 'youtube', key: string, videoId: string, thumbnailSrc: string | null }
```

`thumbnailSrc` is either a `data:image/jpeg;base64,...` string (ready to use as `<img src>`) or `null`.

### In `YouTubeFacade.tsx`
Replace the current CDN fetch approach with a `thumbnailSrc` prop:

- **`thumbnailSrc` is a string** → render facade with `<img src={thumbnailSrc} />`, no external request. Add `onError` handler that falls back to plain link (handles corrupt/truncated data gracefully).
- **`thumbnailSrc` is `null`** → render as plain `<a href>` clickable link. No facade, no external request.
- **Click play** → load YouTube iframe (unchanged)

Remove: `thumbnailQuality` state, quality-fallback `onError` chain, direct `getYouTubeThumbnailURL` call.

### In `YouTubeEmbed.tsx`
Add `thumbnailSrc?: string | null` prop, pass through to `YouTubeFacade`.

### In `Message.tsx`
Pass `tokenData.thumbnailSrc` to `YouTubeEmbed`.

### In `MessageMarkdownRenderer.tsx`
Receive `embeddedMedia` as a prop (extracted from message content at the call site). In the `img` handler for `alt === 'youtube-embed'`, call `getEmbeddedMedia(...)` to resolve `thumbnailSrc` and pass to `YouTubeFacade`.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `src/types/message.ts` | **quorum-shared** | Add `embeddedMedia` field to `PostMessage` |
| `src/utils/youtubeUtils.ts` | quorum-desktop | Add `fetchYouTubeThumbnailAsBase64()`, `extractStandaloneYouTubeVideoIds()` |
| `src/utils/embeddedMedia.ts` *(new)* | quorum-desktop | `getEmbeddedMedia()` helper |
| `src/hooks/business/messages/useMessageComposer.ts` | quorum-desktop | Fetch thumbnails, attach `embeddedMedia` before send |
| `src/hooks/business/messages/useMessageFormatting.ts` | quorum-desktop | Extend youtube token with `thumbnailSrc` |
| `src/components/ui/YouTubeFacade.tsx` | quorum-desktop | Replace CDN fetch with `thumbnailSrc` prop |
| `src/components/ui/YouTubeEmbed.tsx` | quorum-desktop | Add `thumbnailSrc` prop, pass through |
| `src/components/message/Message.tsx` | quorum-desktop | Pass `thumbnailSrc` to `YouTubeEmbed` |
| `src/components/message/MessageMarkdownRenderer.tsx` | quorum-desktop | Pass `embeddedMedia`; use `getEmbeddedMedia()` in img handler |
| `src/services/MessageService.ts` | quorum-desktop | Receiving-side validation: reject messages with >5 `embeddedMedia` entries or any entry exceeding the agreed size limit |

## Edge Cases

| Case | Behavior |
|------|----------|
| Fetch fails | Send without thumbnail; receiver sees plain link |
| > 3 standalone YouTube URLs | First 3 embedded; extras are plain links |
| Some fetches succeed, some fail | Successful ones embedded; failed ones are plain links |
| Old message (no `embeddedMedia`) | Plain clickable link, no external request |
| Inline YouTube URL | No change — plain clickable link |
| Video ID not in `embeddedMedia` | Plain clickable link |
| Corrupt/truncated base64 | `onError` on `<img>` falls back to plain link |
| `EditMessage` | Out of scope — edits do not re-fetch thumbnails; YouTube URLs in edits show as plain links |

## Future Uses of `embeddedMedia`

The same field supports future features without further protocol changes:

- **Image + caption:** sender uploads image → `type: 'image'`, `key: '<uuid>'`, `data: base64`. Placeholder token in text marks position.
- **Link previews:** sender fetches OG image → `type: 'link-preview'`, `key: '<url-hash>'`.
- **GIF thumbnails:** same pattern as YouTube.

---

*Created: 2026-03-11 | Updated: 2026-03-12*
