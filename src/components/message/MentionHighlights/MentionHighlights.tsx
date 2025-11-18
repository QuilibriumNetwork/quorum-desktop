import React, { useMemo } from 'react';
import { highlightMentions, containsMentions } from '../../../utils/mentionHighlighting';
import './MentionHighlights.scss';

interface MentionHighlightsProps {
  /** The text content to highlight mentions in */
  text: string;
  /** Additional CSS class name for styling */
  className?: string;
}

/**
 * MentionHighlights component renders highlighted text behind a textarea
 *
 * This component creates an overlay that renders text with mentions highlighted,
 * positioned exactly behind a textarea to provide visual feedback while typing.
 *
 * Key features:
 * - Matches textarea font, padding, and line-height exactly
 * - Invisible to pointer events (doesn't interfere with typing)
 * - Unified mention highlighting for all mention types
 * - Optimized to only process when mentions are detected
 *
 * @param text - The text content to process for mention highlighting
 * @param className - Optional additional CSS class
 */
export const MentionHighlights: React.FC<MentionHighlightsProps> = ({
  text,
  className = '',
}) => {
  // Optimize by only processing text that contains mentions
  const processedHtml = useMemo(() => {
    if (!text || !containsMentions(text)) {
      // Return escaped text without highlights if no mentions detected
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    return highlightMentions(text);
  }, [text]);

  return (
    <div
      className={`mention-highlights ${className}`}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
      aria-hidden="true"
    />
  );
};

export default MentionHighlights;