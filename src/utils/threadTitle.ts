import type { Message, PostMessage } from '@quilibrium/quorum-shared';

export const THREAD_TITLE_MAX_CHARS = 100;

/**
 * Derive a thread's effective display title.
 *
 * Resolution order:
 *   1. `threadMeta.customTitle` — the user-set title (only present on the
 *      thread's root message).
 *   2. First ~100 chars of the root message's text content, with markdown
 *      syntax stripped.
 *   3. Literal `'Thread'` fallback for empty or content-less roots.
 *
 * The argument is structurally typed so callers can pass either a full
 * Message or a partial shape (e.g., when only `content` and `threadMeta`
 * are known).
 */
export function getThreadTitle(
  rootMessage: Pick<Message, 'content' | 'threadMeta'> | null | undefined
): string {
  if (!rootMessage) return 'Thread';
  if (rootMessage.threadMeta?.customTitle) return rootMessage.threadMeta.customTitle;
  if (!rootMessage.content) return 'Thread';
  const content = rootMessage.content as PostMessage;
  if (!content.text) return 'Thread';
  const text = Array.isArray(content.text) ? content.text.join(' ') : content.text;
  const clean = text.replace(/[*_~`#>[\]()!]/g, '').trim();
  if (!clean) return 'Thread';
  return clean.length > THREAD_TITLE_MAX_CHARS
    ? clean.substring(0, THREAD_TITLE_MAX_CHARS)
    : clean;
}
