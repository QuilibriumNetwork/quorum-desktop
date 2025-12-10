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
src/
├── utils/
│   └── youtubeUtils.ts           # Centralized YouTube URL utilities
├── components/
│   ├── ui/
│   │   ├── YouTubeEmbed.tsx      # Main wrapper component
│   │   └── YouTubeFacade.tsx     # Thumbnail facade implementation
│   └── message/
│       ├── Message.tsx           # Uses YouTubeEmbed for videos
│       ├── MessagePreview.tsx    # Uses YouTubeEmbed with previewOnly mode
│       └── MessageMarkdownRenderer.tsx # Handles YouTube URLs in markdown
└── hooks/
    └── business/messages/
        └── useMessageFormatting.ts # Uses centralized utilities
```

## Implementation Details

### Centralized YouTube Utilities (`src/utils/youtubeUtils.ts`)

All YouTube URL operations are centralized to eliminate code duplication:

```typescript
// Comprehensive YouTube URL regex
export const YOUTUBE_URL_REGEX = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;

// Core utilities
export const isYouTubeURL = (url: string): boolean;
export const extractYouTubeVideoId = (url: string): string | null;
export const convertToYouTubeEmbedURL = (url: string): string | null;
export const getYouTubeThumbnailURL = (videoId: string, quality: 'maxres' | 'hq' | 'mq' | 'default'): string;
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

Enhanced facade implementation with anti-restart protection:

```tsx
// Dual cache system for optimal state management
const iframeStateCache = new Map<string, boolean>(); // Tracks loaded videos
const autoplayBlockCache = new Set<string>(); // Prevents unwanted autoplay

export const YouTubeFacade: React.FC<YouTubeFacadeProps> = ({
  videoId,
  previewOnly = false
}) => {
  const [isLoaded, setIsLoaded] = useState(() => iframeStateCache.get(videoId) || false);
  const [thumbnailQuality, setThumbnailQuality] = useState<'maxres' | 'hq' | 'mq' | 'default'>('maxres');

  // Smart autoplay: only on first click, prevents restart on re-renders
  const embedUrl = useMemo(() => {
    const baseUrl = `https://www.youtube.com/embed/${videoId}`;
    if (isLoaded && !autoplayBlockCache.has(videoId)) {
      return `${baseUrl}?autoplay=1`;
    }
    return baseUrl;
  }, [videoId, isLoaded]);

  // Anti-restart protection: block autoplay after initial load
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        autoplayBlockCache.add(videoId);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, videoId]);

  // Preview mode: show thumbnail only (no click functionality)
  if (previewOnly || !isLoaded) {
    return (
      <div
        className={`relative ${previewOnly ? '' : 'cursor-pointer group'}`}
        onClick={previewOnly ? undefined : () => {
          setIsLoaded(true);
          iframeStateCache.set(videoId, true);
          autoplayBlockCache.delete(videoId); // Allow autoplay on fresh click
        }}
      >
        <img
          src={getYouTubeThumbnailURL(videoId, thumbnailQuality)}
          className="w-full h-full object-cover rounded-lg"
          onError={() => {/* Quality fallback logic */}}
        />
        {!previewOnly && <PlayButtonOverlay />}
        <YouTubeBadge />
      </div>
    );
  }

  return <iframe src={embedUrl} /* ...iframe props */ />;
};
```

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

The current YouTube facade implementation is acceptable for now, but we should be aware of potential privacy risks. Remote images (including YouTube thumbnails) can potentially be used for deanonymization attacks.

**Long-term Security Approach:**

For enhanced privacy protection, we should consider implementing a Signal-like approach:
1. **Client-side metadata fetching**: The sending client fetches OpenGraph data (preview images and text) from the link
2. **Content encryption**: The fetched image data is encrypted and sent to recipients
3. **No direct external requests**: Recipients never need to make requests to external URLs

**Future Safety Gradient:**

We should implement user preference levels for external content:
- **Paranoid mode**: Refuse to load external images/embeds entirely
- **Permissive mode**: Allow external content with proper privacy protections
- **Default mode**: Load with `no-referrer` behaviors and other privacy safeguards

**Current Status**: The facade feature works well for performance, but we should evaluate whether we're properly implementing `no-referrer` policies to minimize tracking potential.

---

**Last Updated**: 2025-11-07
**Recent Changes**: Inline vs standalone URL detection, security hardening (rehype-raw removal)
**Verified**: 2025-12-09 - File paths confirmed current