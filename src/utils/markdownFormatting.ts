/**
 * Markdown Formatting Utilities
 *
 * Functions to wrap selected text with markdown syntax.
 * Used by the MarkdownToolbar component.
 */

export interface FormatResult {
  newText: string; // Full text with formatting applied
  newStart: number; // New selection start position
  newEnd: number; // New selection end position
}

/**
 * Core wrapping function that handles adding prefix/suffix to selected text
 */
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  prefix: string,
  suffix?: string
): FormatResult {
  const actualSuffix = suffix ?? prefix;
  const selectedText = text.substring(start, end);
  const before = text.substring(0, start);
  const after = text.substring(end);

  // If no text is selected, insert syntax with cursor in the middle
  if (start === end) {
    const newText = before + prefix + actualSuffix + after;
    return {
      newText,
      newStart: start + prefix.length,
      newEnd: start + prefix.length,
    };
  }

  // Check if text is already wrapped with this syntax
  const isWrapped =
    before.endsWith(prefix) && after.startsWith(actualSuffix);

  if (isWrapped) {
    // Remove the wrapping (toggle off)
    const newBefore = before.substring(0, before.length - prefix.length);
    const newAfter = after.substring(actualSuffix.length);
    const newText = newBefore + selectedText + newAfter;
    return {
      newText,
      newStart: start - prefix.length,
      newEnd: end - prefix.length,
    };
  }

  // Add the wrapping
  const newText = before + prefix + selectedText + actualSuffix + after;
  return {
    newText,
    newStart: start + prefix.length,
    newEnd: end + prefix.length,
  };
}

/**
 * Toggle bold formatting: **text**
 */
export function toggleBold(
  text: string,
  start: number,
  end: number
): FormatResult {
  return wrapSelection(text, start, end, '**');
}

/**
 * Toggle italic formatting: *text*
 */
export function toggleItalic(
  text: string,
  start: number,
  end: number
): FormatResult {
  return wrapSelection(text, start, end, '*');
}

/**
 * Toggle strikethrough formatting: ~~text~~
 */
export function toggleStrikethrough(
  text: string,
  start: number,
  end: number
): FormatResult {
  return wrapSelection(text, start, end, '~~');
}

/**
 * Wrap text in inline code: `text`
 */
export function wrapCode(
  text: string,
  start: number,
  end: number
): FormatResult {
  return wrapSelection(text, start, end, '`');
}

/**
 * Insert block quote: > text
 * For multiline selections, adds > to each line
 */
export function insertBlockQuote(
  text: string,
  start: number,
  end: number
): FormatResult {
  const selectedText = text.substring(start, end);
  const before = text.substring(0, start);
  const after = text.substring(end);

  // If no text is selected, insert quote syntax
  if (start === end) {
    const newText = before + '> ' + after;
    return {
      newText,
      newStart: start + 2,
      newEnd: start + 2,
    };
  }

  // Check if already quoted (starts with "> ")
  const lines = selectedText.split('\n');
  const allLinesQuoted = lines.every((line) => line.startsWith('> '));

  if (allLinesQuoted) {
    // Remove quotes (toggle off)
    const unquotedText = lines.map((line) => line.substring(2)).join('\n');
    const newText = before + unquotedText + after;
    const removedChars = lines.length * 2; // ">" + " " per line
    return {
      newText,
      newStart: start,
      newEnd: end - removedChars,
    };
  }

  // Add quotes to each line
  const quotedText = lines.map((line) => '> ' + line).join('\n');
  const newText = before + quotedText + after;
  const addedChars = lines.length * 2; // "> " per line
  return {
    newText,
    newStart: start,
    newEnd: end + addedChars,
  };
}

/**
 * Insert heading (always H3): ### text
 * Only applies to the line containing the selection
 */
export function insertHeading(
  text: string,
  start: number,
  end: number
): FormatResult {
  const before = text.substring(0, start);
  const after = text.substring(end);

  // Find the start of the current line
  const lineStart = before.lastIndexOf('\n') + 1;
  const linePrefix = text.substring(lineStart, start);
  const beforeLine = text.substring(0, lineStart);

  // Check if line already starts with "### "
  if (linePrefix.startsWith('### ')) {
    // Remove heading (toggle off)
    const newLinePrefix = linePrefix.substring(4);
    const newText = beforeLine + newLinePrefix + text.substring(start);
    return {
      newText,
      newStart: start - 4,
      newEnd: end - 4,
    };
  }

  // Add heading
  const newText = beforeLine + '### ' + text.substring(lineStart);
  return {
    newText,
    newStart: start + 4,
    newEnd: end + 4,
  };
}

/**
 * Type for formatting functions
 */
export type FormatFunction = (
  text: string,
  start: number,
  end: number
) => FormatResult;
