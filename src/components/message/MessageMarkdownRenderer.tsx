import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollContainer } from '../primitives';
import ClickToCopyContent from '../ui/ClickToCopyContent';
import {
  extractCodeContent,
  shouldUseScrollContainer,
  getScrollContainerMaxHeight,
} from '../../utils/codeFormatting';

interface MessageMarkdownRendererProps {
  content: string;
  className?: string;
}

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

  const processedContent = fixUnclosedCodeBlocks(convertHeadersToH3(content));
  // Reusable copy button component
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

  // Custom component overrides for markdown elements
  const components = {
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

    // Disable markdown links for now (keep existing link handling)
    // Just render the text content without link functionality
    a: ({ children }: any) => <span>{children}</span>,

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
  };

  return (
    <div className={`break-words ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};