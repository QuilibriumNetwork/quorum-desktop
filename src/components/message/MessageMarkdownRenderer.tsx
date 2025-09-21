import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ScrollContainer } from '../primitives';
import ClickToCopyContent from '../ui/ClickToCopyContent';
import { YouTubeEmbed } from '../ui/YouTubeEmbed';
import {
  extractCodeContent,
  shouldUseScrollContainer,
  getScrollContainerMaxHeight,
} from '../../utils/codeFormatting';
import {
  isYouTubeURL,
  convertToYouTubeEmbedURL,
  replaceYouTubeURLsInText,
  YOUTUBE_URL_DETECTION_REGEX
} from '../../utils/youtubeUtils';

interface MessageMarkdownRendererProps {
  content: string;
  className?: string;
}


// Stable processing functions outside component to prevent re-creation
const processURLs = (text: string): string => {
  // Replace non-YouTube URLs with markdown links, avoiding code blocks and existing markdown links
  return text.replace(/^(?!.*```[\s\S]*?```.*$)(.*)$/gm, (line) => {
    // Only process lines that don't contain code blocks
    if (line.includes('```')) {
      return line;
    }

    // Replace non-YouTube URLs with markdown links, but avoid URLs already in markdown links or angle brackets
    return line.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g, (url, offset) => {
      // Check if this URL is already part of a markdown link or angle bracket autolink
      const beforeUrl = line.substring(0, offset);
      const afterUrl = line.substring(offset + url.length);

      // Look for markdown link pattern: ](URL) - URL is already inside a markdown link
      if (beforeUrl.includes('](') || (beforeUrl.endsWith('](') && afterUrl.startsWith(')'))) {
        return url; // Don't modify - already in markdown link
      }

      // Look for partial markdown link pattern: [text](URL - we're at the URL part
      const linkStart = beforeUrl.lastIndexOf('[');
      const linkMiddle = beforeUrl.lastIndexOf('](');
      if (linkStart > -1 && linkMiddle > linkStart && linkMiddle === beforeUrl.length - 2) {
        return url; // Don't modify - already in markdown link
      }

      // Look for angle bracket autolinks: <URL>
      if (beforeUrl.endsWith('<') && afterUrl.startsWith('>')) {
        return url; // Don't modify - already in angle bracket autolink
      }

      return isYouTubeURL(url) ? url : `[${url}](${url})`;
    });
  });
};

const processStandaloneYouTubeUrls = (text: string): string => {
  return replaceYouTubeURLsInText(text, (url) => {
    // Check if URL is on its own line (standalone)
    const lines = text.split('\n');
    const isStandalone = lines.some(line => line.trim() === url);

    if (isStandalone) {
      return `<div data-youtube-url="${url}" class="youtube-placeholder"></div>`;
    }
    return url; // Keep inline YouTube URLs as-is for link processing
  });
};

// Reusable copy button component - outside component to prevent re-creation
const CopyButton = ({ codeContent }: { codeContent: string }) => (
  <div className="absolute top-1 right-1 w-8 h-8 z-50">
    <ClickToCopyContent
      text={codeContent}
      className="w-full h-full flex items-center justify-center"
      iconSize="sm"
      iconClassName="text-subtle hover:text-main"
      tooltipLocation="top"
      copyOnContentClick={true}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4"></div>
      </div>
    </ClickToCopyContent>
  </div>
);

export const MessageMarkdownRenderer: React.FC<MessageMarkdownRendererProps> = ({
  content,
  className = '',
}) => {

  // Convert H1 and H2 headers to H3 since only H3 is allowed
  const convertHeadersToH3 = (text: string): string => {
    // Don't convert headers inside code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];

    // Extract code blocks and replace with placeholders
    let textWithPlaceholders = text.replace(codeBlockRegex, (match, index) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Convert H1 and H2 to H3
    textWithPlaceholders = textWithPlaceholders
      .replace(/^##\s/gm, '### ')  // H2 to H3
      .replace(/^#\s/gm, '### ');  // H1 to H3

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      textWithPlaceholders = textWithPlaceholders.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return textWithPlaceholders;
  };

  // Fix unclosed code blocks by adding missing closing ```
  const fixUnclosedCodeBlocks = (text: string): string => {
    // Split by ``` to analyze the structure
    const parts = text.split('```');

    // If odd number of parts, we have an unclosed code block
    if (parts.length % 2 === 0) {
      // Find the last opening ``` and close it properly
      const lastPart = parts[parts.length - 1];
      // Add closing ``` on a new line to ensure proper formatting
      return text + (lastPart.endsWith('\n') ? '```' : '\n```');
    }

    return text;
  };

  // Simplified processing pipeline with stable dependencies
  const processedContent = useMemo(() => {
    return fixUnclosedCodeBlocks(
      convertHeadersToH3(
        processURLs(
          processStandaloneYouTubeUrls(content)
        )
      )
    );
  }, [content]); // Only content as dependency since functions are now stable

  // Memoize components to prevent re-creation and YouTube component remounting
  const components = useMemo(() => ({
    // Disable most headers but allow H3
    h1: () => null,
    h2: () => null,
    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-bold text-subtle mt-4 mb-2 first:mt-0" {...props}>
        {children}
      </h3>
    ),
    h4: () => null,
    h5: () => null,
    h6: () => null,

    // Handle links - render YouTube embeds for YouTube URLs, regular links for others
    a: ({ href, children, ...props }: any) => {
      if (href && isYouTubeURL(href)) {
        const embedUrl = convertToYouTubeEmbedURL(href);
        if (embedUrl) {
          return (
            <YouTubeEmbed
              src={embedUrl}
              className="rounded-lg youtube-embed"
              style={{
                width: '100%',
                maxWidth: 560,
                aspectRatio: '16/9',
              }}
            />
          );
        }
      }

      // For non-YouTube links, render as regular clickable links
      if (href) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
            {...props}
          >
            {children}
          </a>
        );
      }

      // If no href, just render as plain text
      return <span>{children}</span>;
    },

    // Enhanced code block rendering with scroll and copy functionality
    pre: ({ children, ...props }: any) => {
      const codeContent = extractCodeContent(children);
      const useScroll = shouldUseScrollContainer(codeContent);
      const maxHeight = getScrollContainerMaxHeight();

      if (useScroll) {
        return (
          <div className="relative my-2 last:mb-0 w-full min-w-0">
            <CopyButton codeContent={codeContent} />
            <ScrollContainer maxHeight={maxHeight} showBorder={true} borderRadius="md" className="bg-surface-4 w-full min-w-0">
              <pre className="p-3 font-mono text-subtle text-sm whitespace-pre-wrap break-all overflow-wrap-anywhere min-w-0 max-w-full" {...props}>
                {children}
              </pre>
            </ScrollContainer>
          </div>
        );
      }

      return (
        <div className="relative my-2 last:mb-0 w-full min-w-0">
          <CopyButton codeContent={codeContent} />
          <pre className="bg-surface-4 border border-default rounded-lg p-3 font-mono text-sm text-subtle whitespace-pre-wrap break-words w-full min-w-0" {...props}>
            {children}
          </pre>
        </div>
      );
    },

    // Simple inline code rendering without copy functionality
    code: ({ children, className, ...props }: any) => {
      const isCodeBlock = className?.includes('language-');

      // If this is part of a code block, let the pre handler deal with it
      if (isCodeBlock) {
        return <code className={className} {...props}>{children}</code>;
      }

      // Simple inline code styling
      return (
        <code
          className="bg-surface-4 border border-default px-1.5 py-0.5 rounded text-xs font-mono mx-0.5 text-accent-500"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Style blockquotes
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        className="border-l-4 border-accent/50 pl-4 py-1 my-2 text-subtle italic"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Style tables with proper formatting
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-default" {...props}>
          {children}
        </table>
      </div>
    ),

    thead: ({ children, ...props }: any) => (
      <thead className="bg-surface-3" {...props}>
        {children}
      </thead>
    ),

    th: ({ children, ...props }: any) => (
      <th className="border border-default px-3 py-2 text-left font-semibold" {...props}>
        {children}
      </th>
    ),

    td: ({ children, ...props }: any) => (
      <td className="border border-default px-3 py-2" {...props}>
        {children}
      </td>
    ),

    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-surface-1 transition-colors duration-150" {...props}>
        {children}
      </tr>
    ),

    // Style lists
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc ml-6 my-2 last:mb-0" {...props}>
        {children}
      </ul>
    ),

    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal ml-6 my-2 last:mb-0" {...props}>
        {children}
      </ol>
    ),

    li: ({ children, ...props }: any) => (
      <li className="mb-1 leading-relaxed [&>ul]:mt-1 [&>ol]:mt-1" {...props}>
        {children}
      </li>
    ),

    // Style horizontal rules
    hr: ({ ...props }: any) => (
      <hr className="border-default my-4" {...props} />
    ),

    // Style paragraphs
    p: ({ children, ...props }: any) => (
      <p className="mb-2 last:mb-0" {...props}>
        {children}
      </p>
    ),

    // Handle YouTube placeholder divs
    div: ({ children, className, 'data-youtube-url': youtubeUrl, ...props }: any) => {
      if (className === 'youtube-placeholder' && youtubeUrl) {
        if (isYouTubeURL(youtubeUrl)) {
          const embedUrl = convertToYouTubeEmbedURL(youtubeUrl);
          if (embedUrl) {
            return (
              <div className="my-2">
                <YouTubeEmbed
                  src={embedUrl}
                  className="rounded-lg youtube-embed"
                  style={{
                    width: '100%',
                    maxWidth: 560,
                    aspectRatio: '16/9',
                  }}
                />
              </div>
            );
          }
        }
      }

      // For regular divs, render normally
      return (
        <div className={className} {...props}>
          {children}
        </div>
      );
    },

    // Style strikethrough
    del: ({ children, ...props }: any) => (
      <del className="line-through opacity-70" {...props}>
        {children}
      </del>
    ),

    // Style bold
    strong: ({ children, ...props }: any) => (
      <strong className="font-semibold text-strong" {...props}>
        {children}
      </strong>
    ),

    // Style italic
    em: ({ children, ...props }: any) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),

  }), []); // Empty dependency array since components don't depend on props/state

  return (
    <div className={`break-words ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};