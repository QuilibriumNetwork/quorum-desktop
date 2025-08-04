import { useMemo } from 'react';
import { Message } from '../../../api/quorumApi';

export interface UseSearchResultHighlightProps {
  message: Message;
  searchTerms: string[];
  contextWords?: number;
  maxLength?: number;
}

export interface UseSearchResultHighlightReturn {
  messageText: string;
  contextualSnippet: string;
}

/**
 * Handles text extraction and contextual snippet generation for search results
 * This hook is platform-agnostic and manages text processing logic
 */
export const useSearchResultHighlight = ({
  message,
  searchTerms,
  contextWords = 12,
  maxLength = 200,
}: UseSearchResultHighlightProps): UseSearchResultHighlightReturn => {
  // Extract message text
  const messageText = useMemo(() => {
    // Only 'post' messages are searchable and appear in search results
    if (message.content.type === 'post') {
      const content = message.content.text;
      return Array.isArray(content) ? content.join(' ') : content;
    }
    return '';
  }, [message]);

  // Generate contextual snippet around search terms
  const contextualSnippet = useMemo(() => {
    const text = messageText;

    if (!searchTerms.length || !text.trim()) {
      return text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;
    }

    // Split text into words
    const words = text.split(/\s+/);

    // Find the first occurrence of any search term
    let foundIndex = -1;

    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      for (let i = 0; i < words.length; i++) {
        if (words[i].toLowerCase().includes(termLower)) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex !== -1) break;
    }

    // If no terms found, return truncated text from beginning
    if (foundIndex === -1) {
      return text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;
    }

    // Calculate snippet boundaries
    const startIndex = Math.max(0, foundIndex - contextWords);
    const endIndex = Math.min(words.length, foundIndex + contextWords + 1);

    // Extract snippet
    let snippet = words.slice(startIndex, endIndex).join(' ');

    // Add ellipsis if we're not at the start/end
    if (startIndex > 0) {
      snippet = '...' + snippet;
    }
    if (endIndex < words.length) {
      snippet = snippet + '...';
    }

    // If snippet is still too long, truncate it
    if (snippet.length > maxLength) {
      snippet = snippet.substring(0, maxLength - 3) + '...';
    }

    return snippet;
  }, [messageText, searchTerms, contextWords, maxLength]);

  return {
    messageText,
    contextualSnippet,
  };
};
