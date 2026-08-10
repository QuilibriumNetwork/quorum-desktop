import { resolveMemberName, formatResolvedName } from './resolveMemberName';

export interface SearchableConversation {
  address: string;
  displayName?: string | null;
  primaryUsername?: string | null;
}

/**
 * Does a DM conversation match what the user typed in the list's search box?
 *
 * ## Match the name that is ON SCREEN
 *
 * The row renders the RESOLVED name, so when a partner's QNS name outranks
 * their display name the list reads "alice.q" while `displayName` still holds
 * "Alice Smith". Matching only the stored field meant searching for the one
 * name you could actually see found nothing — the list showed a row it then
 * refused to find.
 *
 * ## Why the stored name still matches too
 *
 * This is deliberately a SUPERSET of matching the resolved name alone: a name
 * that is no longer displayed is still a name the user may remember someone by,
 * and dropping it would silently make previously-findable conversations
 * unfindable. Widening what matches can only surprise someone with an extra
 * result; narrowing it loses a conversation they were looking for.
 *
 * @param query - raw user input; trimmed and lowercased here so callers cannot
 *   forget to and get a search that only matches lowercase names.
 */
export function conversationMatchesSearch(
  conversation: SearchableConversation,
  query: string,
): boolean {
  const needle = query.toLowerCase().trim();
  if (!needle) return true;

  const resolved = formatResolvedName(
    resolveMemberName({
      address: conversation.address,
      displayName: conversation.displayName,
      primaryUsername: conversation.primaryUsername,
    }),
  ).toLowerCase();

  return (
    resolved.includes(needle) ||
    !!conversation.displayName?.toLowerCase().includes(needle) ||
    !!conversation.address?.toLowerCase().includes(needle)
  );
}
