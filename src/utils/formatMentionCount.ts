/**
 * Formats a mention count for display
 *
 * @param count - The mention count to format
 * @param threshold - Maximum number to display before showing "+" (default: 99)
 * @returns Formatted string for display
 *
 * @example
 * // For channels (default threshold of 99):
 * formatMentionCount(5)     // "5"
 * formatMentionCount(99)    // "99"
 * formatMentionCount(100)   // "99+"
 * formatMentionCount(250)   // "99+"
 *
 * // For space icons (threshold of 9):
 * formatMentionCount(3, 9)  // "3"
 * formatMentionCount(9, 9)  // "9"
 * formatMentionCount(10, 9) // "9+"
 */
export function formatMentionCount(count: number, threshold: number = 99): string {
  if (count > threshold) {
    return `${threshold}+`;
  }
  return count.toString();
}
