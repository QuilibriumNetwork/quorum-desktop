import React from 'react';
import { YouTubeFacade } from './YouTubeFacade';
import { extractYouTubeVideoId } from '../../utils/youtubeUtils';

interface YouTubeEmbedProps {
  src: string;
  title?: string;
  allow?: string;
  style?: React.CSSProperties;
  className?: string;
  previewOnly?: boolean; // If true, shows only thumbnail without click-to-play functionality
}

/**
 * YouTube-specific embed component that uses the facade pattern
 * for better performance. Shows a thumbnail preview that loads
 * the full iframe only when clicked.
 */
export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  src,
  title,
  allow = "autoplay; encrypted-media",
  style,
  className = '',
  previewOnly = false,
}) => {
  // Extract YouTube video ID from the embed URL
  const youtubeVideoId = extractYouTubeVideoId(src);

  if (!youtubeVideoId) {
    // Fallback for invalid YouTube URLs
    console.warn('Invalid YouTube URL:', src);
    return (
      <iframe
        src={src}
        title={title}
        allow={allow}
        className={`youtube-embed rounded-lg ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      style={style}
      className={`relative youtube-embed rounded-lg ${className}`}
    >
      <YouTubeFacade
        videoId={youtubeVideoId}
        className={className}
        style={style}
        title={title}
        previewOnly={previewOnly}
      />
    </div>
  );
};