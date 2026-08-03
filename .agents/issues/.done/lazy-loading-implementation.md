---
type: task
title: Lazy Loading Implementation for Message Lists
status: done
created: 2025-01-19T00:00:00.000Z
updated: '2026-01-09'
---

# Lazy Loading Implementation for Message Lists


**Priority**: High
**Type**: Performance Optimization
**Platform**: Cross-platform (Web + Mobile)


## Overview

Implement lazy loading for images and videos in message lists to improve performance when displaying media-rich content. This affects both the main message list and pinned messages panel, with cross-platform considerations for web (Virtuoso) and mobile (FlatList).

## Problem Statement

Currently, all images and YouTube embeds in message lists load immediately when messages render, causing:
- **Network congestion**: 20+ simultaneous HTTP requests during scroll
- **Memory usage**: All media loaded in DOM/memory regardless of visibility
- **Performance degradation**: Especially with 50+ pinned messages containing media
- **Bandwidth waste**: Loading off-screen content unnecessarily

## Solution Architecture

### Phase 1: Web Implementation (Virtuoso-based)
Create in-house lazy loading solution using native Intersection Observer API.

**Key Components:**
1. `useLazyLoad` hook - Custom intersection observer hook
2. `LazyImage` component - Lazy loading for images with placeholder
3. `LazyIframe` component - Lazy loading for YouTube embeds
4. Update `Message.tsx` and `MessagePreview.tsx` components

### Phase 2: Mobile Implementation (FlatList-based)
Adapt solution for React Native using platform-specific APIs.

**Key Components:**
1. `useLazyLoad.native.ts` - React Native intersection observer polyfill
2. `LazyImage.native.tsx` - React Native lazy image component
3. `LazyIframe.native.tsx` - React Native WebView-based lazy iframe
4. Update mobile message components

## Technical Specifications

### Web Platform (Priority 1)

#### useLazyLoad Hook
```typescript
// src/hooks/ui/useLazyLoad.ts
interface UseLazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export const useLazyLoad = (options?: UseLazyLoadOptions) => {
  // Native Intersection Observer implementation
}
```

#### LazyImage Component
```typescript
// src/components/ui/LazyMedia.tsx
export const LazyImage: React.FC<{
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ src, alt, style, className, onClick }) => {
  // Intersection observer with placeholder
}
```

#### LazyIframe Component
```typescript
export const LazyIframe: React.FC<{
  src: string;
  title?: string;
  allow?: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ src, title, allow, style, className }) => {
  // YouTube embed lazy loading
}
```

### Mobile Platform (Priority 2)

#### React Native Considerations
- **No Intersection Observer**: Need polyfill or alternative detection
- **FlatList instead of Virtuoso**: Different virtualization approach
- **WebView for iframes**: YouTube embeds via WebView component
- **Image handling**: React Native Image component optimizations

#### Alternative Detection Methods
1. **onViewableItemsChanged** (FlatList native)
2. **react-native-intersection-observer** (polyfill)
3. **Custom scroll position tracking**

## Implementation Plan

### Phase 1: Web Foundation (Week 1)
- [ ] Create `useLazyLoad` hook with Intersection Observer
- [ ] Implement `LazyImage` component with placeholder
- [ ] Implement `LazyIframe` component for YouTube embeds
- [ ] Add TypeScript definitions
- [ ] Write unit tests for lazy loading components

#### Detailed Placeholder Design Specifications

**LazyImage Placeholder States:**
1. **Loading Skeleton**: Animated shimmer effect matching image dimensions
   - Gray gradient animation (surface-4 → surface-6 → surface-4)
   - Maintains aspect ratio of target image when known
   - Default 16:9 ratio for unknown dimensions
   - Rounded corners matching current image styling (`rounded-lg`)
   - CSS-only animations for 60fps performance

2. **Error State**: Clean fallback when image fails to load
   - Icon placeholder (exclamation-triangle with) (use Icon primitive)
   - Background color (surface-4)
   - "Image unavailable" text for accessibility (use lingui sintax) class: text-subtle
   - Same dimensions as intended image

3. **Transition**: Smooth fade-in when actual image loads
   - 200ms opacity transition
   - No layout shift (preserve placeholder dimensions)
   - Maintain click handlers for image modal functionality

**LazyIframe (YouTube) Loading Logic:**
1. **Immediate Rendering**: Fresh user messages (< 10 seconds old)
   - User just posted message with YouTube link → Render iframe immediately
   - Preserves expected UX for user's own fresh posts
   - No lazy loading for sender's recent messages

2. **Lazy Loading**: Existing/older messages and other users' content
   - Messages older than 10 seconds
   - Messages from other users
   - Messages outside initial viewport

3. **YouTube Placeholder States**:
   - **Static Video Placeholder**:
     - Generic video play icon (text-subtle) on surface-4 background (use Icon primitive)
     - rounded borders matching current video embed styling (`rounded-lg`)
     - responsive like current video embed styling
     - "YouTube Video" accessibility label
     - 16:9 aspect ratio maintained (`youtube-embed` class)
     - CSS-only styling, no thumbnail fetching

   - **Loading State**: When lazy loading triggers
     - Replace placeholder with actual YouTube iframe

**Implementation Logic in Message.tsx:**
```tsx
if (tokenData.type === 'youtube') {
  const isFreshUserMessage = (
    message.content.senderId === user.currentPasskeyInfo!.address &&
    Date.now() - new Date(message.createdDate).getTime() < 10000
  );

  if (isFreshUserMessage) {
    // Immediate embed for fresh user posts
    return <iframe src={...} className="rounded-lg youtube-embed" />;
  } else {
    // Lazy load for everything else
    return <LazyIframe src={...} className="rounded-lg youtube-embed" />;
  }
}
```

**Performance Considerations:**
- Placeholder rendering must be <16ms (1 frame at 60fps)
- No additional network requests for placeholder content
- Maintain scrolling performance during skeleton animations
- Preserve existing image click/zoom functionality
- Zero bundle size increase (native APIs only)

### Phase 2: Web Integration (Week 1)
- [ ] Update `Message.tsx` to use lazy loading components
- [ ] Update `MessagePreview.tsx` to use lazy loading components
- [ ] Test with Virtuoso in main message list
- [ ] Test with Virtuoso in pinned messages panel
- [ ] Performance testing with 50+ media messages

### Phase 3: Mobile Research (Week 2)
- [ ] Research React Native lazy loading solutions
- [ ] Evaluate FlatList + intersection observer polyfills
- [ ] Design mobile-specific lazy loading architecture
- [ ] Plan WebView integration for YouTube embeds

### Phase 4: Mobile Implementation (Week 3)
- [ ] Create `useLazyLoad.native.ts` hook
- [ ] Implement `LazyImage.native.tsx` component
- [ ] Implement `LazyIframe.native.tsx` with WebView
- [ ] Update mobile message components
- [ ] Test with FlatList virtualization

### Phase 5: Testing & Optimization (Week 4)
- [ ] Cross-platform testing
- [ ] Performance benchmarking (before/after)
- [ ] Memory usage analysis
- [ ] Network request optimization verification
- [ ] User experience testing

## Performance Targets

### Before Implementation
- **Initial Load**: 5-8 images + 2-3 YouTube embeds load immediately
- **Scroll Performance**: 20+ simultaneous media requests during scroll
- **Memory Usage**: All media content loaded in memory
- **Network**: Burst loading pattern

### After Implementation
- **Initial Load**: Placeholder-only rendering
- **Scroll Performance**: 3-4 media requests spread over time (75% reduction)
- **Memory Usage**: Only visible content loaded (80% reduction)
- **Network**: On-demand loading pattern

## Cross-Platform Architecture

```
src/
├── hooks/
│   ├── ui/
│   │   ├── useLazyLoad.ts          # Web implementation
│   │   └── useLazyLoad.native.ts   # Mobile implementation
├── components/
│   ├── ui/
│   │   ├── LazyMedia.tsx           # Web components
│   │   └── LazyMedia.native.tsx    # Mobile components
│   ├── message/
│   │   ├── Message.tsx             # Updated for web
│   │   ├── Message.native.tsx      # Updated for mobile
│   │   ├── MessagePreview.tsx      # Updated for web
│   │   └── MessagePreview.native.tsx # Updated for mobile
```

## Libraries Considered

### ❌ Rejected Options
- **react-lazyload**: Conflicts with Virtuoso scroll handling
- **react-lazy-load-image-component**: Images only, no iframe support
- **react-intersection-observer**: Adds 3KB for simple use case

### ✅ Chosen Approach
- **Native Intersection Observer**: Zero bundle size, perfect Virtuoso compatibility
- **Custom implementation**: Full control over cross-platform behavior
- **Platform-specific optimizations**: Tailored for web/mobile differences

## Dependencies

### Web Platform
- Native Intersection Observer API (built into browsers)
- React hooks (useState, useEffect, useRef)
- No external dependencies

### Mobile Platform
- react-native-intersection-observer (potential polyfill)
- React Native WebView (for iframe embeds)
- React Native Image optimizations

## Testing Strategy

### Unit Tests
- [ ] useLazyLoad hook behavior
- [ ] LazyImage component loading states
- [ ] LazyIframe component loading states
- [ ] Cross-platform component parity

### Integration Tests
- [ ] Virtuoso + lazy loading compatibility
- [ ] FlatList + lazy loading compatibility
- [ ] Message list performance with 50+ media items
- [ ] Pinned messages panel performance

### Performance Tests
- [ ] Network request reduction measurement
- [ ] Memory usage before/after comparison
- [ ] Scroll performance benchmarking
- [ ] Initial load time improvement

## Risks & Mitigations

### Technical Risks
1. **Intersection Observer browser support**
   - *Mitigation*: Excellent modern browser support (95%+)
   - *Fallback*: Native lazy loading attribute for images

2. **React Native complexity**
   - *Mitigation*: Phased approach, research first
   - *Fallback*: FlatList native optimization features

3. **Performance regression**
   - *Mitigation*: Thorough benchmarking before/after
   - *Fallback*: Feature flag for gradual rollout

### UX Risks
1. **Loading state jarring**
   - *Mitigation*: Smooth placeholder transitions
   - *Solution*: Skeleton loading states

2. **YouTube embed delays**
   - *Mitigation*: Larger rootMargin for earlier loading
   - *Solution*: Thumbnail preview before full embed

## Success Metrics

### Performance KPIs
- [ ] 75% reduction in simultaneous network requests
- [ ] 80% reduction in initial memory usage
- [ ] 50% faster initial message list render
- [ ] Smooth 60fps scrolling with media content

### User Experience KPIs
- [ ] No jarring layout shifts during loading
- [ ] Sub-100ms placeholder-to-content transition
- [ ] Maintained image click/zoom functionality
- [ ] Preserved YouTube embed interactions

## Future Enhancements

### Phase 5: Advanced Optimizations
- [ ] Image preloading based on scroll direction
- [ ] Adaptive quality based on connection speed
- [ ] Progressive image loading (blur-to-sharp)
- [ ] YouTube thumbnail extraction for faster previews

### Phase 6: Accessibility
- [ ] Screen reader announcements for loading states
- [ ] Keyboard navigation support
- [ ] High contrast mode compatibility
- [ ] Reduced motion preferences

---

**Assigned to**: Development Team
**Estimated Effort**: 4 weeks
**Dependencies**: None
**Blocking**: None

**Last Updated**: 2025-01-20 - Added detailed placeholder specifications and immediate vs lazy loading logic for YouTube embeds
