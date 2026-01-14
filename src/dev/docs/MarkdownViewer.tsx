import React, { useEffect } from 'react';
import {
  Container,
  Text,
  Flex,
  Button,
  Icon,
} from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
import { useMarkdownContent, MarkdownFile } from './hooks/useMarkdownFiles';
import Prism from 'prismjs';
import 'prismjs/themes/prism-dark.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';

interface MarkdownViewerProps {
  filePath: string;
  onBack: () => void;
  title: string;
  file?: MarkdownFile; // Add file prop for frontmatter access
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  filePath,
  onBack,
  title,
  file,
}) => {
  const { content, loading, error } = useMarkdownContent(filePath);

  // Format date to human-readable format
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Strip YAML frontmatter from content
  const stripFrontmatter = (markdown: string): string => {
    // Remove YAML frontmatter (--- ... ---)
    return markdown.replace(/^---\n[\s\S]*?\n---\n\n?/, '');
  };

  // Enhanced markdown-to-HTML conversion
  const renderMarkdown = (markdown: string) => {
    // Strip frontmatter first
    const cleanedMarkdown = stripFrontmatter(markdown);

    // First, protect code blocks from paragraph processing
    const codeBlockPlaceholders: string[] = [];
    const tablePlaceholders: string[] = [];
    
    // Helper function to process inline markdown in table cells
    const processInlineMarkdown = (text: string): string => {
      return text
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-strong">$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-surface-2 px-1 py-0.5 rounded text-sm font-mono text-accent">$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="link" target="_blank" rel="noopener noreferrer">$1</a>');
    };
    
    // Process tables first (before other replacements)
    const html = cleanedMarkdown
      // Extract and protect tables
      .replace(/(\|[^\n]+\|\n)(\|[\s:|-]+\|\n)((?:\|[^\n]+\|\n?)+)/g, (match, header, separator, body) => {
        const placeholder = `__TABLE_${tablePlaceholders.length}__`;
        
        // Parse header row
        const headerCells = header.trim().split('|').filter(cell => cell.trim());
        const headerRow = headerCells.map(cell => 
          `<th class="border border-default px-3 py-2 text-left font-semibold bg-surface-2">${processInlineMarkdown(cell.trim())}</th>`
        ).join('');
        
        // Parse body rows
        const bodyRows = body.trim().split('\n').map(row => {
          const cells = row.split('|').filter(cell => cell.trim());
          const rowCells = cells.map(cell => 
            `<td class="border border-default px-3 py-2">${processInlineMarkdown(cell.trim())}</td>`
          ).join('');
          return `<tr class="hover:bg-surface-1">${rowCells}</tr>`;
        }).join('');
        
        const tableHtml = `
          <div class="overflow-x-auto my-6">
            <table class="min-w-full border-collapse border border-default">
              <thead>
                <tr>${headerRow}</tr>
              </thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        `;
        
        tablePlaceholders.push(tableHtml);
        return placeholder;
      })
      // Extract and protect code blocks with syntax highlighting
      .replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const cleanCode = code.trim();
        const placeholder = `__CODE_BLOCK_${codeBlockPlaceholders.length}__`;

        // Map common language aliases
        const languageMap: { [key: string]: string } = {
          js: 'javascript',
          ts: 'typescript',
          jsx: 'jsx',
          tsx: 'tsx',
          json: 'json',
          css: 'css',
          bash: 'bash',
          sh: 'bash',
          shell: 'bash',
        };

        const normalizedLang = lang ? languageMap[lang] || lang : 'javascript';

        // Apply syntax highlighting if language is supported
        let highlightedCode = cleanCode;
        if (lang && Prism.languages[normalizedLang]) {
          try {
            highlightedCode = Prism.highlight(
              cleanCode,
              Prism.languages[normalizedLang],
              normalizedLang
            );
          } catch (e) {
            // Fallback to plain text if highlighting fails
            highlightedCode = cleanCode;
          }
        }

        codeBlockPlaceholders.push(
          `<pre class="bg-surface-3 border border-default rounded-lg p-4 my-6 overflow-x-auto"><code class="text-sm font-mono language-${normalizedLang}" style="display: block; line-height: 1.4; white-space: pre; margin: 0; padding: 0; font-size: 13px;">${highlightedCode}</code></pre>`
        );
        return placeholder;
      })

      // Headers
      .replace(
        /^#### (.*$)/gm,
        (match, text) =>
          `<h4 class="text-base font-semibold text-strong mt-4 mb-2">${text}</h4>`
      )
      .replace(
        /^### (.*$)/gm,
        (match, text) =>
          `<h3 class="text-lg font-semibold text-strong mt-6 mb-3">${text}</h3>`
      )
      .replace(
        /^## (.*$)/gm,
        (match, text) =>
          `<h2 class="text-xl font-semibold text-strong mt-8 mb-4">${text}</h2>`
      )
      .replace(
        /^# (.*$)/gm,
        (match, text) =>
          `<h1 class="text-2xl font-bold text-strong mt-8 mb-6">${text}</h1>`
      )

      // Inline code (must come before other inline formatting)
      .replace(
        /`([^`]+)`/g,
        (match, code) =>
          `<code class="bg-surface-2 px-2 py-1 rounded text-sm font-mono text-accent font-medium">${code}</code>`
      )

      // Bold and italic
      .replace(
        /\*\*([^*]+)\*\*/g,
        (match, text) =>
          `<strong class="font-semibold text-strong">${text}</strong>`
      )
      .replace(
        /\*([^*]+)\*/g,
        (match, text) => `<em class="italic">${text}</em>`
      )

      // Links (using a function to properly handle replacements)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        return `<a href="${url}" class="link" target="_blank" rel="noopener noreferrer">${text}</a>`;
      })

      // Lists (improved) - using function to avoid $2 issues
      .replace(
        /^(\d+)\. (.*$)/gm,
        (match, num, text) => `<li class="ml-6 mb-1 list-decimal">${text}</li>`
      )
      .replace(
        /^[\-\*\+] (.*$)/gm,
        (match, text) => `<li class="ml-6 mb-1 list-disc">${text}</li>`
      )

      // Blockquotes
      .replace(
        /^\> (.*$)/gm,
        (match, text) =>
          `<blockquote class="border-l-4 border-accent/50 pl-4 py-2 my-4 bg-accent/5 italic text-subtle rounded-r-lg">${text}</blockquote>`
      )

      // Horizontal rules
      .replace(/^---+$/gm, '<hr class="border-default my-8" />')
      .replace(/^\*\*\*+$/gm, '<hr class="border-default my-8" />');

    // Convert line breaks and paragraphs - skip code block and table placeholders entirely
    const processedHtml = html
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        // Skip code block and table placeholders completely - don't process them at all
        if (trimmed.includes('__CODE_BLOCK_') || trimmed.includes('__TABLE_')) {
          return trimmed;
        }
        // Only add <br /> for empty lines that aren't part of special elements
        if (!trimmed) return '';
        if (
          trimmed.startsWith('<h') ||
          trimmed.startsWith('<li') ||
          trimmed.startsWith('<blockquote') ||
          trimmed.startsWith('<hr') ||
          trimmed.startsWith('<pre') ||
          trimmed.startsWith('</')
        ) {
          return trimmed;
        }
        return `<p class="mb-3 leading-relaxed">${trimmed}</p>`;
      })
      .filter((line) => line !== '') // Remove empty lines
      .join('\n')
      // Clean up empty paragraphs and fix list wrapping
      .replace(/<p class="mb-3 leading-relaxed"><\/p>/g, '')
      .replace(/(<li[^>]*>.*?<\/li>)/gs, (match) =>
        match.replace(/<\/?p[^>]*>/g, '')
      );

    // Restore tables and code blocks
    let finalHtml = tablePlaceholders.reduce((result, table, index) => {
      return result.replace(`__TABLE_${index}__`, table);
    }, processedHtml);
    
    finalHtml = codeBlockPlaceholders.reduce((result, codeBlock, index) => {
      return result.replace(`__CODE_BLOCK_${index}__`, codeBlock);
    }, finalHtml);
    
    return finalHtml;
  };

  return (
    <Container className="min-h-screen bg-app">
      <DevNavMenu currentPath={window.location.pathname} />
      <Container padding="lg" className="mx-auto max-w-4xl">
        <Flex gap="md" align="center" className="mb-6">
          <Button type="subtle" size="small" onClick={onBack}>
            <Icon name="arrow-left" size="sm" />
            Back
          </Button>
          <Text variant="subtle" size="sm" className="font-mono">
            {filePath}
          </Text>
        </Flex>

        {loading && (
          <div className="text-center py-8">
            <Text variant="subtle">Loading markdown content...</Text>
          </div>
        )}

        {error && !loading && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-6">
            <Text variant="main" className="text-danger">
              {error}
            </Text>
          </div>
        )}

        {!loading && content && (
          <div className="bg-surface-1 rounded-lg border border-default p-6">
            {/* Frontmatter Metadata Box - Inside main content */}
            {file && (
              <div className="bg-surface-2 rounded-lg border border-default p-3 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                  {file.frontmatter?.type && (
                    <div className="flex items-center gap-2">
                      <Text variant="subtle" size="sm">Type:</Text>
                      <Text variant="main" size="sm" weight="medium" className="capitalize">{file.frontmatter.type}</Text>
                    </div>
                  )}
                  {file.status && (
                    <div className="flex items-center gap-2">
                      <Text variant="subtle" size="sm">Status:</Text>
                      <Text variant="main" size="sm" weight="medium" className="capitalize">{file.status.replace(/-/g, ' ')}</Text>
                    </div>
                  )}
                  {file.complexity && (
                    <div className="flex items-center gap-2">
                      <Text variant="subtle" size="sm">Complexity:</Text>
                      <Text variant="main" size="sm" weight="medium" className="capitalize">{file.complexity.replace(/-/g, ' ')}</Text>
                    </div>
                  )}
                  {file.created && (
                    <div className="flex items-center gap-2">
                      <Text variant="subtle" size="sm">Created:</Text>
                      <Text variant="main" size="sm">{formatDate(file.created)}</Text>
                    </div>
                  )}
                  {file.updated && (
                    <div className="flex items-center gap-2">
                      <Text variant="subtle" size="sm">Updated:</Text>
                      <Text variant="main" size="sm">{formatDate(file.updated)}</Text>
                    </div>
                  )}
                  {file.ai_generated && (
                    <div className="flex items-center gap-2">
                      <Text variant="subtle" size="sm">AI Generated:</Text>
                      <Text variant="main" size="sm">Yes</Text>
                    </div>
                  )}
                  {file.reviewed_by && (
                    <div className="flex items-center gap-2">
                      <Text variant="subtle" size="sm">Reviewed By:</Text>
                      <Text variant="main" size="sm" className="capitalize">{file.reviewed_by}</Text>
                    </div>
                  )}
                  {file.related_issues && file.related_issues.length > 0 && (
                    <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
                      <Text variant="subtle" size="sm">Related Issues:</Text>
                      <div className="flex flex-wrap gap-1">
                        {file.related_issues.map((issue) => (
                          <Text key={issue} variant="main" size="sm" className="bg-surface-3 px-1.5 py-0.5 rounded">{issue}</Text>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Markdown Content */}
            <div
              className="prose max-w-none text-main"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          </div>
        )}

        {!loading && !content && !error && (
          <div className="text-center py-8">
            <Text variant="subtle">No content found</Text>
          </div>
        )}
      </Container>
    </Container>
  );
};
