/**
 * Centralized YouTube URL utilities
 * Consolidates all YouTube URL detection, validation, and conversion logic
 */

// Comprehensive YouTube URL regex that covers all formats
export const YOUTUBE_URL_REGEX = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;

// More permissive regex for detecting YouTube URLs in text
export const YOUTUBE_URL_DETECTION_REGEX = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/g;

/**
 * Checks if a URL is a valid YouTube URL
 */
export const isYouTubeURL = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  return YOUTUBE_URL_REGEX.test(url.trim());
};

/**
 * Extracts video ID from a YouTube URL
 * Returns null if URL is invalid or not a YouTube URL
 */
export const extractYouTubeVideoId = (url: string): string | null => {
  if (!url || typeof url !== 'string') return null;

  const match = url.trim().match(YOUTUBE_URL_REGEX);
  return match ? match[1] : null;
};

/**
 * Converts any YouTube URL format to embed URL
 * Returns null if URL is invalid
 */
export const convertToYouTubeEmbedURL = (url: string): string | null => {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

/**
 * Generates YouTube thumbnail URL with quality fallback
 */
export const getYouTubeThumbnailURL = (
  videoId: string,
  quality: 'maxres' | 'hq' | 'mq' | 'default' = 'maxres'
): string => {
  const qualityMap = {
    maxres: 'maxresdefault.jpg',    // 1280x720
    hq: 'hqdefault.jpg',            // 480x360
    mq: 'mqdefault.jpg',            // 320x180
    default: 'default.jpg'          // 120x90
  };

  return `https://i.ytimg.com/vi/${videoId}/${qualityMap[quality]}`;
};

/**
 * Validates video ID format
 */
export const isValidYouTubeVideoId = (videoId: string): boolean => {
  if (!videoId || typeof videoId !== 'string') return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
};

/**
 * Finds all YouTube URLs in text and returns their positions and video IDs
 */
export const findYouTubeURLsInText = (text: string): Array<{
  url: string;
  videoId: string;
  start: number;
  end: number;
}> => {
  if (!text) return [];

  const matches = [];
  let match;

  // Reset regex lastIndex
  YOUTUBE_URL_DETECTION_REGEX.lastIndex = 0;

  while ((match = YOUTUBE_URL_DETECTION_REGEX.exec(text)) !== null) {
    const url = match[0];
    const videoId = extractYouTubeVideoId(url);

    if (videoId) {
      matches.push({
        url,
        videoId,
        start: match.index,
        end: match.index + url.length
      });
    }
  }

  return matches;
};

/**
 * Replaces YouTube URLs in text with a custom replacement function
 */
export const replaceYouTubeURLsInText = (
  text: string,
  replacer: (url: string, videoId: string) => string
): string => {
  if (!text) return text;

  return text.replace(YOUTUBE_URL_DETECTION_REGEX, (match) => {
    const videoId = extractYouTubeVideoId(match);
    return videoId ? replacer(match, videoId) : match;
  });
};