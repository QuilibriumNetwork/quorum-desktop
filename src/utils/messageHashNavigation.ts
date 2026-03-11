// src/utils/messageHashNavigation.ts

export type HashTarget =
  | { type: 'message'; messageId: string }
  | { type: 'threadMessage'; rootMessageId: string; messageId: string };

/**
 * Parse a URL hash into a structured navigation target.
 * Supports:
 *   #msg-{messageId}                              → message in main feed
 *   #thread-{rootMessageId}-msg-{messageId}       → message inside a thread
 *
 * The rootMessageId identifies the thread's root message (which has threadMeta).
 * The messageId identifies the specific reply to scroll to within the thread.
 */
export function parseMessageHash(hash: string): HashTarget | null {
  if (!hash || !hash.startsWith('#')) return null;

  // Thread message: #thread-{rootMessageId}-msg-{replyMessageId}
  const threadMatch = hash.match(/^#thread-(.+)-msg-(.+)$/);
  if (threadMatch) {
    return { type: 'threadMessage', rootMessageId: threadMatch[1], messageId: threadMatch[2] };
  }

  // Regular message: #msg-{messageId}
  const msgMatch = hash.match(/^#msg-(.+)$/);
  if (msgMatch) {
    return { type: 'message', messageId: msgMatch[1] };
  }

  return null;
}

/**
 * Build a URL hash for navigating to a message.
 * If rootMessageId is provided, builds a compound thread hash.
 */
export function buildMessageHash(messageId: string, rootMessageId?: string): string {
  if (rootMessageId) {
    return `#thread-${rootMessageId}-msg-${messageId}`;
  }
  return `#msg-${messageId}`;
}
