# Embedded Media + YouTube Facade Privacy Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a generic `embeddedMedia` attachment system on `PostMessage`, then use it to eliminate receiver-side YouTube thumbnail fetches — fixing the privacy leak while laying groundwork for future image+caption and link preview features.

**Architecture:** `PostMessage` (in quorum-shared) gains an optional `embeddedMedia` array. At send time, `useMessageComposer` detects standalone YouTube URLs, fetches `hqdefault` thumbnails in parallel, and attaches them as `embeddedMedia` entries. `YouTubeFacade` is reworked to accept a pre-resolved `thumbnailSrc` prop instead of fetching from YouTube's CDN. When no embedded data is present, it renders a plain clickable link — no external request.

**Tech Stack:** TypeScript, React, `youtubeUtils.ts`, fetch API, quorum-shared

**Spec:** `.agents/tasks/2026-03-12-embedded-media-spec.md`
**GitHub:** https://github.com/QuilibriumNetwork/quorum-desktop/issues/125

**Notes for implementer:**
- **EditMessage:** Out of scope. Edits do not re-fetch thumbnails. YouTube URLs in edited text show as plain links on new clients.
- **CSP:** No changes needed. `index.html` already has `img-src * data: blob:` which covers `data:` URIs.
- **Standalone URL:** A line whose entire trimmed content is exactly one YouTube URL. Cap at 3 per message (first 3 in document order).
- **Corrupt base64:** Add `onError` on the embedded `<img>` to fall back to plain link — no broken image icons.
- **quorum-shared:** `PostMessage` is canonical there. Use `yarn link` locally during development; publish and bump version for release.

---

## Chunk 1: quorum-shared Protocol Change

### Task 1: Add `embeddedMedia` to `PostMessage` in quorum-shared

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-shared\src\types\message.ts`

- [ ] **Step 1: Add the field**

  Find the `PostMessage` type and add the optional field:

  ```typescript
  export type PostMessage = {
    senderId: string;
    type: 'post';
    text: string | string[];
    repliesToMessageId?: string;
    embeddedMedia?: Array<{
      type: string;
      key: string;
      data: string;
      mimeType: string;
    }>;
  };
  ```

- [ ] **Step 2: Build quorum-shared to verify no type errors**

  ```bash
  cd d:\GitHub\Quilibrium\quorum-shared
  yarn build
  ```
  Expected: clean build

- [ ] **Step 3: Link quorum-shared locally into quorum-desktop**

  ```bash
  cd d:\GitHub\Quilibrium\quorum-shared
  yarn link

  cd d:\GitHub\Quilibrium\quorum-desktop
  yarn link @quilibrium/quorum-shared
  ```

- [ ] **Step 4: Verify quorum-desktop compiles with linked package**

  ```bash
  cd d:\GitHub\Quilibrium\quorum-desktop
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```
  Expected: no errors

- [ ] **Step 5: Commit quorum-shared change**

  ```bash
  cd d:\GitHub\Quilibrium\quorum-shared
  git add src/types/message.ts
  git commit -m "feat: add embeddedMedia field to PostMessage"
  ```

---

## Chunk 2: quorum-desktop Utility Layer

### Task 2: Add YouTube utilities and embeddedMedia helper

**Files:**
- Modify: `src/utils/youtubeUtils.ts`
- Create: `src/utils/embeddedMedia.ts`

- [ ] **Step 1: Add `extractStandaloneYouTubeVideoIds` to `youtubeUtils.ts`**

  Append to end of file:

  ```typescript
  /**
   * Returns up to 3 video IDs for YouTube URLs that appear alone on their own
   * line in the given text (first 3 in document order).
   */
  export const extractStandaloneYouTubeVideoIds = (text: string): string[] => {
    const lines = text.split('\n');
    const ids: string[] = [];
    for (const line of lines) {
      if (ids.length >= 3) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isYouTubeURL(trimmed)) {
        const videoId = extractYouTubeVideoId(trimmed);
        if (videoId && !ids.includes(videoId)) ids.push(videoId);
      }
    }
    return ids;
  };

  /**
   * Fetches the hqdefault YouTube thumbnail for a video ID.
   * Returns base64-encoded JPEG string (no data URI prefix), or null on failure.
   */
  export const fetchYouTubeThumbnailAsBase64 = async (
    videoId: string
  ): Promise<string | null> => {
    const url = getYouTubeThumbnailURL(videoId, 'hq');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };
  ```

- [ ] **Step 2: Create `src/utils/embeddedMedia.ts`**

  ```typescript
  import type { PostMessage } from '../api/quorumApi';

  type MessageContent = { embeddedMedia?: PostMessage['embeddedMedia'] };

  /**
   * Looks up an embedded media entry by type and key.
   * Returns a ready-to-use data URI string, or null if not found.
   */
  export const getEmbeddedMediaSrc = (
    content: MessageContent | undefined | null,
    type: string,
    key: string
  ): string | null => {
    const entry = content?.embeddedMedia?.find(
      (m) => m.type === type && m.key === key
    );
    if (!entry) return null;
    return `data:${entry.mimeType};base64,${entry.data}`;
  };
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/utils/youtubeUtils.ts src/utils/embeddedMedia.ts
  git commit -m "feat: add YouTube thumbnail fetch utilities and embeddedMedia helper"
  ```

---

## Chunk 3: Sending Side

### Task 3: Fetch and attach thumbnails before sending

**Files:**
- Modify: `src/hooks/business/messages/useMessageComposer.ts`

- [ ] **Step 1: Add imports**

  Add to the existing imports from `youtubeUtils`:
  ```typescript
  import {
    // ...existing imports...
    fetchYouTubeThumbnailAsBase64,
    extractStandaloneYouTubeVideoIds,
  } from '../../../utils/youtubeUtils';
  ```

- [ ] **Step 2: Replace the `pendingMessage` send block**

  Find this pattern in `submitMessage`:
  ```typescript
  if (pendingMessage) {
    await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
  }
  ```

  Replace with:
  ```typescript
  if (pendingMessage) {
    const videoIds = extractStandaloneYouTubeVideoIds(pendingMessage);
    let messagePayload: string | object = pendingMessage;

    if (videoIds.length > 0) {
      const results = await Promise.all(
        videoIds.map(async (videoId) => {
          const data = await fetchYouTubeThumbnailAsBase64(videoId);
          if (!data) return null;
          return {
            type: 'youtube-thumbnail',
            key: videoId,
            data,
            mimeType: 'image/jpeg',
          };
        })
      );
      const embeddedMedia = results.filter(
        (r): r is NonNullable<typeof r> => r !== null
      );
      if (embeddedMedia.length > 0) {
        messagePayload = {
          type: 'post' as const,
          text: pendingMessage,
          embeddedMedia,
        };
      }
    }

    await onSubmitMessage(messagePayload, inReplyTo?.messageId);
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

- [ ] **Step 4: Smoke test — confirm sender makes one thumbnail request**

  - Open DevTools → Network → filter `i.ytimg.com`
  - Send a message that is just a YouTube URL on its own line
  - Confirm: exactly one request to `i.ytimg.com` at send time

- [ ] **Step 5: Commit**

  ```bash
  git add src/hooks/business/messages/useMessageComposer.ts
  git commit -m "feat: fetch and embed YouTube thumbnails as embeddedMedia before sending"
  ```

---

## Chunk 4: Receiving Side

### Task 4: Thread thumbnail data through token processing

**Files:**
- Modify: `src/hooks/business/messages/useMessageFormatting.ts`

- [ ] **Step 1: Import `getEmbeddedMediaSrc`**

  ```typescript
  import { getEmbeddedMediaSrc } from '../../../utils/embeddedMedia';
  ```

- [ ] **Step 2: Extend the youtube token (around line 238)**

  Find:
  ```typescript
  if (isYouTubeURL(token)) {
    const videoId = extractYouTubeVideoId(token);
    if (videoId) {
      return {
        type: 'youtube' as const,
        key: `${messageId}-${lineIndex}-${tokenIndex}`,
        videoId,
      };
    }
  }
  ```

  Replace with:
  ```typescript
  if (isYouTubeURL(token)) {
    const videoId = extractYouTubeVideoId(token);
    if (videoId) {
      const thumbnailSrc = getEmbeddedMediaSrc(
        message.content as any,
        'youtube-thumbnail',
        videoId
      );
      return {
        type: 'youtube' as const,
        key: `${messageId}-${lineIndex}-${tokenIndex}`,
        videoId,
        thumbnailSrc,
      };
    }
  }
  ```

  `thumbnailSrc` is either a ready `data:image/jpeg;base64,...` string or `null`.

- [ ] **Step 3: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/hooks/business/messages/useMessageFormatting.ts
  git commit -m "feat: resolve embeddedMedia thumbnail into youtube token"
  ```

---

### Task 5: Rework YouTubeFacade to use thumbnailSrc prop

**Files:**
- Modify: `src/components/ui/YouTubeFacade.tsx`

This is the core rendering change. The component stops fetching from YouTube's CDN entirely.

- [ ] **Step 1: Update the props interface**

  Find the `YouTubeFacadeProps` interface and replace it:

  ```typescript
  interface YouTubeFacadeProps {
    videoId: string;
    /** Pre-resolved data URI for the thumbnail, or null to show plain link. */
    thumbnailSrc: string | null;
    previewOnly?: boolean;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
  }
  ```

- [ ] **Step 2: Remove CDN fetch state and logic**

  Remove:
  - `thumbnailQuality` state
  - `getYouTubeThumbnailURL` import (if no longer used)
  - The `onError` quality-fallback handler on the thumbnail `<img>`

- [ ] **Step 3: Rewrite the facade render section**

  Replace the thumbnail rendering section (the part before the iframe) with:

  ```typescript
  // No embedded data → plain link, no external request
  if (thumbnailSrc === null) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return (
      <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="link">
        {videoUrl}
      </a>
    );
  }

  // Has embedded data → facade with no external requests
  if (!isLoaded) {
    return (
      <div
        className={`relative ${previewOnly ? '' : 'cursor-pointer group'} ${className}`}
        style={style}
        onClick={
          previewOnly
            ? undefined
            : () => {
                setIsLoaded(true);
                iframeStateCache.set(videoId, true);
                autoplayBlockCache.delete(videoId);
              }
        }
      >
        <img
          src={thumbnailSrc}
          alt={title ?? 'YouTube video thumbnail'}
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => {
            // Corrupt/truncated data — hide image, show plain link instead
            const el = e.currentTarget.parentElement;
            if (el) el.replaceWith(
              Object.assign(document.createElement('a'), {
                href: `https://www.youtube.com/watch?v=${videoId}`,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'link',
                textContent: `https://www.youtube.com/watch?v=${videoId}`,
              })
            );
          }}
        />
        {!previewOnly && <PlayButtonOverlay />}
        <YouTubeBadge />
      </div>
    );
  }

  // Loaded → iframe (unchanged from current behavior)
  return <iframe src={embedUrl} /* ...existing props... */ />;
  ```

  Keep all existing iframe-related state (`isLoaded`, `iframeStateCache`, `autoplayBlockCache`, `embedUrl`) unchanged.

- [ ] **Step 4: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/ui/YouTubeFacade.tsx
  git commit -m "feat: rework YouTubeFacade to use embedded thumbnailSrc, remove CDN fetch"
  ```

---

### Task 6: Thread thumbnailSrc through YouTubeEmbed and Message

**Files:**
- Modify: `src/components/ui/YouTubeEmbed.tsx`
- Modify: `src/components/message/Message.tsx`

- [ ] **Step 1: Add `thumbnailSrc` prop to `YouTubeEmbed`**

  Update `YouTubeEmbedProps`:
  ```typescript
  interface YouTubeEmbedProps {
    src: string;
    title?: string;
    allow?: string;
    style?: React.CSSProperties;
    className?: string;
    previewOnly?: boolean;
    thumbnailSrc?: string | null;
  }
  ```

  Pass it through to `YouTubeFacade`:
  ```typescript
  <YouTubeFacade
    videoId={youtubeVideoId}
    thumbnailSrc={thumbnailSrc ?? null}
    className={className}
    style={style}
    title={title}
    previewOnly={previewOnly}
  />
  ```

- [ ] **Step 2: Pass `thumbnailSrc` in `Message.tsx` where youtube tokens render (around line 1000)**

  Find:
  ```typescript
  if (tokenData.type === 'youtube') {
    return (
      <Container key={tokenData.key} className="message-post-content">
        <YouTubeEmbed
          src={'https://www.youtube.com/embed/' + tokenData.videoId}
          allow="autoplay; encrypted-media"
          className="rounded-lg youtube-embed"
        />
      </Container>
    );
  }
  ```

  Replace with:
  ```typescript
  if (tokenData.type === 'youtube') {
    return (
      <Container key={tokenData.key} className="message-post-content">
        <YouTubeEmbed
          src={'https://www.youtube.com/embed/' + tokenData.videoId}
          allow="autoplay; encrypted-media"
          className="rounded-lg youtube-embed"
          thumbnailSrc={tokenData.thumbnailSrc}
        />
      </Container>
    );
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/ui/YouTubeEmbed.tsx src/components/message/Message.tsx
  git commit -m "feat: pass thumbnailSrc through YouTubeEmbed to YouTubeFacade"
  ```

---

### Task 7: Update MessageMarkdownRenderer

**Files:**
- Modify: `src/components/message/MessageMarkdownRenderer.tsx`
- Modify: `src/components/message/Message.tsx` (call site)

The markdown renderer handles YouTube URLs that come through markdown messages. It renders `YouTubeFacade` directly in the `img` handler.

- [ ] **Step 1: Add `embeddedMedia` prop to `MessageMarkdownRenderer`**

  Add to the props interface:
  ```typescript
  embeddedMedia?: Array<{ type: string; key: string; data: string; mimeType: string }>;
  ```

- [ ] **Step 2: Import `getEmbeddedMediaSrc`**

  ```typescript
  import { getEmbeddedMediaSrc } from '../../utils/embeddedMedia';
  ```

- [ ] **Step 3: Update the `img` handler (around line 813)**

  Find:
  ```typescript
  if (alt === 'youtube-embed' && src) {
    return (
      <div className="my-2">
        <YouTubeFacade
          videoId={src}
          className="rounded-lg youtube-embed"
          style={{ width: '100%', maxWidth: 560, aspectRatio: '16/9' }}
        />
      </div>
    );
  }
  ```

  Replace with:
  ```typescript
  if (alt === 'youtube-embed' && src) {
    const thumbnailSrc = getEmbeddedMediaSrc(
      { embeddedMedia },
      'youtube-thumbnail',
      src
    );
    return (
      <div className="my-2">
        <YouTubeFacade
          videoId={src}
          thumbnailSrc={thumbnailSrc}
          className="rounded-lg youtube-embed"
          style={{ width: '100%', maxWidth: 560, aspectRatio: '16/9' }}
        />
      </div>
    );
  }
  ```

- [ ] **Step 4: Pass `embeddedMedia` from the call site in `Message.tsx`**

  Find where `MessageMarkdownRenderer` is rendered in `Message.tsx`. Extract `embeddedMedia` from the message content and pass it:

  ```typescript
  const embeddedMedia =
    message.content && 'embeddedMedia' in message.content
      ? (message.content as any).embeddedMedia
      : undefined;

  // ...

  <MessageMarkdownRenderer
    // ...existing props...
    embeddedMedia={embeddedMedia}
  />
  ```

- [ ] **Step 5: Verify TypeScript**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/message/MessageMarkdownRenderer.tsx src/components/message/Message.tsx
  git commit -m "feat: use embeddedMedia in MessageMarkdownRenderer YouTube embed rendering"
  ```

---

## Chunk 5: Verification

### Task 8: End-to-end verification and docs

- [ ] **Step 1: Full build**

  ```bash
  yarn build
  ```
  Expected: no errors

- [ ] **Step 2: Lint**

  ```bash
  yarn lint
  ```
  Expected: no new errors

- [ ] **Step 3: Verify sender fetches thumbnail once**

  - DevTools → Network → filter `i.ytimg.com`
  - Send a message with a standalone YouTube URL
  - Confirm: exactly one request to `i.ytimg.com` at send time

- [ ] **Step 4: Verify receiver makes zero requests**

  - Second browser profile / incognito as a different user
  - DevTools → Network → filter `i.ytimg.com`
  - Receive the message
  - Confirm: **zero requests** to `i.ytimg.com`
  - Confirm: thumbnail is visible (rendered from embedded data)

- [ ] **Step 5: Verify play still works**

  - Click the play button on the received message
  - Confirm: YouTube iframe loads and video plays
  - Confirm: YouTube network request happens only now

- [ ] **Step 6: Verify degradation for old messages (no embeddedMedia)**

  - Temporarily comment out the thumbnail fetch in `useMessageComposer` and send a message
  - Confirm: YouTube URL renders as a plain clickable link
  - Confirm: zero requests to `i.ytimg.com`
  - Revert the temporary change

- [ ] **Step 7: Verify inline YouTube URLs are unchanged**

  - Send: `Check this out https://www.youtube.com/watch?v=abc123 cool right?`
  - Confirm: renders as plain clickable link, no thumbnail, no `i.ytimg.com` request

- [ ] **Step 8: Verify text before + after YouTube URL**

  - Send a multi-line message: text line, YouTube URL line, text line
  - Confirm: text renders above and below the thumbnail facade

- [ ] **Step 9: Update docs**

  In `.agents/docs/features/messages/youtube-facade-optimization.md`, update the Security & Privacy section to note that receiver-side thumbnail fetches have been eliminated via `embeddedMedia`.

  In `.agents/docs/features/security.md`, note the same.

  ```bash
  git add .agents/docs/features/messages/youtube-facade-optimization.md
  git add .agents/docs/features/security.md
  git commit -m "docs: update YouTube facade and security docs to reflect embeddedMedia privacy fix"
  ```

---

*Created: 2026-03-11 | Updated: 2026-03-12*
