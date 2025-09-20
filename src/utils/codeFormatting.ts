/**
 * Code formatting utilities for message markdown rendering
 */

/**
 * Extract text content from React children (used for code blocks)
 */
export function extractCodeContent(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(child => extractCodeContent(child)).join('');
  }

  if (children && typeof children === 'object' && 'props' in children) {
    const element = children as React.ReactElement;
    if (element.props && element.props.children) {
      return extractCodeContent(element.props.children);
    }
  }

  return String(children || '');
}

/**
 * Count the number of lines in a string
 */
export function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}

/**
 * Determine if code content should be scrollable
 */
export function shouldUseScrollContainer(content: string): boolean {
  const lineCount = countLines(content);
  const charCount = content.length;

  // Configurable thresholds
  const MAX_LINES = 10;
  const MAX_CHARS = 500;

  return lineCount > MAX_LINES || charCount > MAX_CHARS;
}

/**
 * Get appropriate max height for scroll container based on screen size
 */
export function getScrollContainerMaxHeight(): string {
  // Using 'xs' preset which maps to 200px in ScrollContainer
  // Options: 'xs' (200px), 'sm' (280px), 'md' (400px), 'lg' (500px), 'xl' (600px)
  return 'xs';
}

/**
 * Determine if inline code should have copy functionality
 */
export function shouldShowInlineCopy(content: string): boolean {
  const MIN_INLINE_COPY_LENGTH = 20;
  return content.length > MIN_INLINE_COPY_LENGTH;
}

/**
 * Format code block language identifier
 * Maps common aliases to standard language names
 */
export function normalizeLanguage(lang?: string): string {
  if (!lang) return 'plaintext';

  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'shell': 'bash',
    'yml': 'yaml',
    'json5': 'json'
  };

  const normalized = lang.toLowerCase();
  return languageMap[normalized] || normalized;
}