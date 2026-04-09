import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { t } from '@lingui/core/macro';
import {
  extractYouTubeVideoId,
  isValidYouTubeVideoId,
} from '@quilibrium/quorum-shared';

interface YouTubeFacadeProps {
  videoId: string;
  /** Pre-resolved data URI for the thumbnail, or null to show plain link. */
  thumbnailSrc: string | null;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  previewOnly?: boolean; // If true, shows only thumbnail without click-to-play functionality
}

// Re-export for backward compatibility
export { extractYouTubeVideoId } from '@quilibrium/quorum-shared';

// DOM persistence cache - tracks which videos are currently loaded as iframes
const iframeStateCache = new Map<string, boolean>();

// Separate cache to track which videos should not autoplay on re-render
const autoplayBlockCache = new Set<string>();

export const YouTubeFacade: React.FC<YouTubeFacadeProps> = ({
  videoId,
  thumbnailSrc,
  className = '',
  style,
  title,
  previewOnly = false
}) => {
  const [isLoaded, setIsLoaded] = useState(() => iframeStateCache.get(videoId) || false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle facade click to load iframe
  const handleFacadeClick = useCallback(() => {
    setIsLoaded(true);
    iframeStateCache.set(videoId, true);
    // Remove from autoplay block cache since user explicitly clicked
    autoplayBlockCache.delete(videoId);
  }, [videoId]);

  // Generate stable embed URL
  const embedUrl = useMemo(() => {
    const baseUrl = `https://www.youtube.com/embed/${videoId}`;

    // Only add autoplay if video is loaded and not blocked from autoplaying
    if (isLoaded && !autoplayBlockCache.has(videoId)) {
      return `${baseUrl}?autoplay=1`;
    }

    return baseUrl;
  }, [videoId, isLoaded]);

  // Block autoplay after initial load to prevent re-autoplay on re-renders
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        autoplayBlockCache.add(videoId);
      }, 3000); // 3 seconds should be enough for autoplay to work

      return () => clearTimeout(timer);
    }
  }, [isLoaded, videoId]);

  // If iframe is loaded and not preview-only, render it directly
  if (isLoaded && !previewOnly) {
    return (
      <div className={`relative ${className}`} style={style}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={title || t`YouTube Video`}
          allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
          allowFullScreen
          className="youtube-embed rounded-lg w-full h-full"
          style={style}
          loading="lazy"
        />
      </div>
    );
  }

  // No embedded data → plain link, no external request
  if (thumbnailSrc === null || thumbnailError) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-subtle hover:text-main transition-colors"
      >
        {videoUrl}
      </a>
    );
  }

  // Render facade with embedded thumbnail
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`relative ${previewOnly ? '' : 'cursor-pointer group'} ${className}`}
        style={style}
        onClick={previewOnly ? undefined : handleFacadeClick}
      >
        {/* Thumbnail from embedded data — no external request */}
        <img
          src={thumbnailSrc}
          alt={title || t`YouTube Video Thumbnail`}
          className="w-full h-full object-cover rounded-lg"
          onError={() => setThumbnailError(true)}
          loading="lazy"
        />

        {/* Play Button Overlay - always show, but interactive only if not preview-only */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-16 h-16">
            {/* YouTube-style play button background */}
            <div className={`absolute inset-0 w-16 h-16 bg-black bg-opacity-70 rounded-full transform scale-100 ${!previewOnly ? 'group-hover:scale-110' : ''} transition-transform duration-200`} />

            {/* Play icon */}
            <div className="relative z-10 w-16 h-16 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white ml-1"
              >
                <path
                  d="M8 5.14v13.72L19 12L8 5.14z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* YouTube logo badge */}
        <div className="absolute bottom-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
          YouTube
        </div>

        {/* Hover overlay - only show if not preview-only */}
        {!previewOnly && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-colors duration-200 rounded-lg" />
        )}
      </div>

      {/* External link to YouTube */}
      <div className="flex justify-start">
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-subtle hover:text-main transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {t`Open video on YouTube`}
        </a>
      </div>
    </div>
  );
};

// Cleanup function to clear iframe state when component unmounts
export const clearYouTubeIframeState = (videoId: string) => {
  iframeStateCache.delete(videoId);
  autoplayBlockCache.delete(videoId);
};

// Get current iframe state
export const getYouTubeIframeState = (videoId: string): boolean => {
  return iframeStateCache.get(videoId) || false;
};

// Reset autoplay state (useful for testing or manual control)
export const resetYouTubeAutoplayState = (videoId: string) => {
  autoplayBlockCache.delete(videoId);
};