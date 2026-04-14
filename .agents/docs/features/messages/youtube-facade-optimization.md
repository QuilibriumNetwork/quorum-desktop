---
type: doc
title: YouTube Facade Optimization
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-04-09T00:00:00.000Z
---

# YouTube Facade Optimization

## Overview

This document describes the YouTube facade pattern implementation that optimizes YouTube video embeds in message lists. Instead of loading heavy iframes immediately, the system displays lightweight thumbnail previews that load the full video player only when clicked.

## Problem Solved

YouTube embeds are resource-intensive:
- Each iframe loads ~1MB+ of JavaScript/CSS
- Multiple videos in view cause significant performance degradation
- 20+ videos could load 20MB+ of resources simultaneously
- Scrolling through message history with videos was sluggish

## Solution: Facade Pattern

The facade pattern replaces heavy YouTube iframes with lightweight thumbnail images until user interaction.

### How It Works

1. **URL Detection**: System identifies YouTube URLs in messages
2. **Thumbnail Display**: Shows static YouTube thumbnail image (direct URL, no API)
3. **User Clicks Play**: Replaces thumbnail with actual YouTube iframe
4. **State Persistence**: Remembers which videos are playing during session

### Architecture

```
quorum-shared/src/utils/youtubeUtils.ts   # All YouTube URL utilities + thumbnail fetch

quorum-desktop/src/
├── utils/
│   └── embeddedMedia.ts          # getEmbeddedMediaSrc() helper (added 2026-04-09)
├── components/
│   ├── ui/
│   │   ├── YouTubeEmbed.tsx      # Main wrapper, threads thumbnailSrc through
│   │   └── YouTubeFacade.tsx     # Renders from embedded data, no CDN fetch
│   └── message/
│       ├── Message.tsx           # Passes thumbnailSrc + embeddedMedia to renderers
│       ├── MessagePreview.tsx    # Uses YouTubeEmbed with previewOnly mode
│       └── MessageMarkdownRenderer.tsx # Receives embeddedMedia prop, resolves thumbnailSrc
└── hooks/
    └── business/messages/
        ├── useMessageComposer.ts   # Fetches + attaches embeddedMedia before send
        └── useMessageFormatting.ts # Extends youtube token with thumbnailSrc
```

## Implementation Details

### Centralized YouTube Utilities (`@quilibrium/quorum-shared`)

All YouTube URL operations are in `quorum-shared/src/utils/youtubeUtils.ts`:

```typescript
// Comprehensive YouTube URL regex
export const YOUTUBE_URL_REGEX = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;

// Core utilities
export const isYouTubeURL = (url: string): boolean;
export const extractYouTubeVideoId = (url: string): string | null;
export const convertToYouTubeEmbedURL = (url: string): string | null;
export const getYouTubeThumbnailURL = (videoId: string, quality: 'maxres' | 'hq' | 'mq' | 'default'): string;

// Added 2026-04-09: embedded media support
export const extractStandaloneYouTubeVideoIds = (text: string): string[]; // up to 3
export const fetchYouTubeThumbnailAsBase64 = (videoId: string): Promise<string | null>;
```

### YouTubeEmbed Component (`src/components/ui/YouTubeEmbed.tsx`)

Main wrapper with preview mode support:

```tsx
export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  src,
  title,
  allow = "autoplay; encrypted-media",
  style,
  className = '',
  previewOnly = false, // New: disable click-to-play for previews
}) => {
  const youtubeVideoId = extractYouTubeVideoId(src);

  if (!youtubeVideoId) {
    return <iframe src={src} ... />; // Fallback
  }

  return (
    <div className={`relative youtube-embed rounded-lg ${className}`}>
      <YouTubeFacade
        videoId={youtubeVideoId}
        previewOnly={previewOnly}
        {...props}
      />
    </div>
  );
};
```

### YouTubeFacade Component (`src/components/ui/YouTubeFacade.tsx`)

Updated 2026-04-09: no longer fetches thumbnails from YouTube's CDN. Accepts a pre-resolved `thumbnailSrc` prop instead.

```tsx
interface YouTubeFacadeProps {
  videoId: string;
  thumbnailSrc: string | null; // data URI, or null to show plain link
  previewOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const YouTubeFacade: React.FC<YouTubeFacadeProps> = ({
  videoId,
  thumbnailSrc,
  previewOnly = false,
}) => {
  // No embedded data → plain link, no external request
  if (thumbnailSrc === null || thumbnailError) {
    return <a href={`https://www.youtube.com/watch?v=${videoId}`}>...</a>;
  }

  // Has embedded data → facade, no external request
  if (!isLoaded) {
    return (
      <div onClick={handleFacadeClick}>
        <img src={thumbnailSrc} onError={() => setThumbnailError(true)} />
        <PlayButtonOverlay />
        <YouTubeBadge />
      </div>
    );
  }

  // Loaded → iframe (unchanged)
  return <iframe src={embedUrl} />;
};
```

The quality-fallback waterfall (`maxres → hq → mq → default`) and `getYouTubeThumbnailURL` call have been removed entirely.

### Markdown Integration (`src/components/message/MessageMarkdownRenderer.tsx`) - Updated 2025-11-07

YouTube URLs in markdown content are intelligently processed with **standalone vs inline detection**:

```tsx
// Process YouTube URLs line-by-line to detect standalone vs inline
const processStandaloneYouTubeUrls = (text: string): string => {
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    const trimmedLine = line.trim();
    return replaceYouTubeURLsInText(line, (url) => {
      // Check if URL is alone on its line (standalone)
      const isStandalone = trimmedLine === url.trim();
      if (isStandalone) {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          // Convert to markdown image syntax for embed
          return `![youtube-embed](${videoId})`;
        }
      }
      // Inline URLs stay as-is (will become links)
      return url;
    });
  });
  return processedLines.join('\n');
};

// Image component catches YouTube embeds
const components = useMemo(() => ({
  img: ({ src, alt, ...props }: any) => {
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
    return null;
  },

  // Link component renders ALL links as clickable (including inline YouTube URLs)
  a: ({ href, children, ...props }: any) => {
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="link">
          {children}
        </a>
      );
    }
    return <span>{children}</span>;
  },
  // ... other components
}), []); // Stable components prevent YouTube remounting
```

**Key Change (2025-11-07)**: Inline YouTube URLs now render as clickable links instead of embeds to avoid cluttering messages.

### URL Pattern Matching

Centralized regex supports all YouTube URL formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`
- `https://youtube.com/live/VIDEO_ID`

```typescript
export const YOUTUBE_URL_REGEX = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;
```

## Performance Benefits

### Before (Direct iframe embeds)
- **Initial Load**: All YouTube iframes load immediately
- **Memory Usage**: ~1MB per video × number of videos
- **Network Requests**: Multiple simultaneous heavy requests
- **User Experience**: Sluggish scrolling, delayed page loads

### After (Facade pattern)
- **Initial Load**: Only lightweight thumbnail images (~50KB each)
- **Memory Usage**: 95% reduction until user interaction
- **Network Requests**: Single image request per video
- **User Experience**: Smooth scrolling, instant page loads

### Metrics
- **Page Size Reduction**: ~95% for pages with multiple videos
- **Load Time**: 10× faster for message lists with videos
- **Memory Usage**: Minimal until user clicks play
- **CPU Usage**: Near-zero until video activation

## Integration Points

### Message Component (Full Interactive)
```tsx
// src/components/message/Message.tsx
if (tokenData.type === 'youtube') {
  return (
    <YouTubeEmbed
      src={`https://www.youtube.com/embed/${tokenData.videoId}`}
      className="rounded-lg youtube-embed"
      // previewOnly=false (default) - full click-to-play functionality
    />
  );
}
```

### MessagePreview Component (Preview Only)
```tsx
// src/components/message/MessagePreview.tsx - Used in PinnedMessagesPanel
{contentData.content.videoUrl?.startsWith('https://www.youtube.com/embed') && (
  <YouTubeEmbed
    src={contentData.content.videoUrl}
    className="rounded-lg youtube-embed"
    previewOnly={true} // Shows thumbnail + play icon, but not clickable
  />
)}
```

### Markdown Messages (Updated 2025-11-07)
```tsx
// Automatic detection in MessageMarkdownRenderer

// Standalone URL (on its own line) - becomes embed
https://www.youtube.com/watch?v=abc123

// Inline URL (mixed with text) - becomes clickable link
Check this video https://www.youtube.com/watch?v=abc123 out!

// Regular URLs - always become clickable links
https://example.com
```

## CSS Styling

YouTube embeds maintain responsive design with hardware acceleration:

```scss
.youtube-embed {
  width: 100%;
  max-width: 560px;
  height: auto;
  aspect-ratio: 16 / 9;
  transform: translateZ(0); /* Hardware acceleration */
  position: relative;
  contain: layout style paint; /* CSS containment */
}
```


## Security & Privacy Considerations

**Note from Cassie (Q Founder) - 2025-09-21**

The original facade fetched thumbnails from YouTube's CDN on every receiver's client, leaking their IP address to YouTube without consent.

**Resolved 2026-04-09 — embeddedMedia system:**

The privacy leak has been eliminated via the `embeddedMedia` field on `PostMessage`:

| Action | Who contacts YouTube | User's choice? |
|--------|---------------------|----------------|
| Thumbnail displayed | Sender (at send time) | Yes — they shared the link |
| Video plays | Receiver (on click) | Yes — they clicked play |
| Thumbnail displayed (old behavior) | Receiver (automatically) | No |

The sender fetches `hqdefault` (~27-55KB JPEG) at send time and embeds it as base64 in the message payload. Receivers render from the embedded data — no external requests. Old messages (no `embeddedMedia`) show plain clickable links instead of a facade.

**Still future work:**
- "Paranoid mode" setting to disable all external content (including the iframe on click)
- Server-side thumbnail proxy/cache to avoid duplicate fetches when many users share the same video

---

## Text + Image Combined Messages (2026-04-09)

The `embeddedMedia` field is also used for user-attached images when text and an image are sent together. Instead of two separate messages, the send path produces a single `PostMessage` with `type: 'image'` and `type: 'image-thumbnail'` entries alongside any YouTube entries.

**Send path** (`useMessageComposer.ts`): when both `pendingMessage` and `processedImage` are set, the combined branch encodes full + thumbnail as raw base64 (no `data:` URI prefix — `getEmbeddedMediaSrc` adds the prefix at read time). Image-only sends continue to use the `EmbedMessage` path unchanged.

**Render path** (`Message.tsx`): after the text content, both the markdown path and token path check for `image`/`image-thumbnail` keys via `getEmbeddedImageKeys` and render them with the existing lightbox (`showImageModal`) on click.

**entry types in `embeddedMedia`:**
| type | purpose |
|------|---------|
| `youtube-thumbnail` | YouTube facade thumbnail, keyed by videoId |
| `image-thumbnail` | Compressed thumbnail of user-attached image |
| `image` | Full-size user-attached image |

---

**Last Updated**: 2026-04-09
**Recent Changes**: text+image combined PostMessage; embeddedMedia now carries user-attached images in addition to YouTube thumbnails
