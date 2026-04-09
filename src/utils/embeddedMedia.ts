import type { PostMessage } from '@quilibrium/quorum-shared';

type EmbeddedMediaContent = { embeddedMedia?: PostMessage['embeddedMedia'] };

/**
 * Looks up an embedded media entry by type and key.
 * Returns a ready-to-use data URI string, or null if not found.
 */
export const getEmbeddedMediaSrc = (
  content: EmbeddedMediaContent | undefined | null,
  type: string,
  key: string
): string | null => {
  const entry = content?.embeddedMedia?.find(
    (m) => m.type === type && m.key === key
  );
  if (!entry) return null;
  return `data:${entry.mimeType};base64,${entry.data}`;
};
