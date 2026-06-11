// useConversationsWithProfileBackfill
//
// The DM sidebar (DirectMessageContactsList) renders displayName / icon
// straight off the local Conversation row. For contacts whose row was
// created before the partner ever broadcast their profile, that row holds
// the literal "Unknown User" name and the default avatar — so the sidebar
// shows a stale identity even though the open-conversation view papers over
// it with a public-profile fallback (DirectMessage.tsx:227-242).
//
// This hook closes that gap with a write-through cache:
//   1. Read  — find rows whose displayName is "Unknown User" OR whose icon
//              is the default (per-field: a contact may be missing only the
//              avatar, only the name, or both).
//   2. Fetch — query the public-profile endpoint for those addresses. Reuses
//              publicProfileQueryKey so the cache is shared with the
//              conversation view — usually already warm, no double fetch.
//   3. Merge  — per-field. A real stored value always wins; only the
//              default / "Unknown User" placeholder is replaced. The merged
//              list is what the sidebar renders, so it's correct on first paint.
//   4. Write-back — persist the resolved values onto the IndexedDB row and
//              invalidate the conversation queries. Subsequent loads (and the
//              conversation header / message avatars, which read the same row)
//              render instantly from local storage with no network flash.
//
// Safety: only fields still holding the default placeholder are ever
// overwritten. A value pushed via dm-update-profile is authoritative and is
// never clobbered by a (possibly stale) public profile.

import { useEffect, useMemo, useRef } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { Conversation } from '@quilibrium/quorum-shared';
import { QuorumApiClient, isHandledFetchError } from '../../../api/baseTypes';
import type { PublicProfileResponse } from '../../../api/baseTypes';
import { publicProfileQueryKey } from '../user/useUserPublicProfile';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { buildConversationsKey } from '../../queries/conversations/buildConversationsKey';
import { buildConversationKey } from '../../queries/conversation/buildConversationKey';
import { DefaultImages } from '../../../utils';
import { logger } from '@quilibrium/quorum-shared';

// "Unknown User" is the literal placeholder stored on rows with no real name
// (MessageService.ts). We can't import the runtime-translated t`Unknown User`
// here without coupling to the i18n macro, and the stored value is the
// English literal at write time, so match that constant directly.
const UNKNOWN_USER_NAME = 'Unknown User';

const isPlaceholderName = (name?: string): boolean =>
  !name || name === UNKNOWN_USER_NAME;

const isPlaceholderIcon = (icon?: string): boolean =>
  !icon || icon === DefaultImages.UNKNOWN_USER;

/**
 * A conversation row augmented with the partner's QNS primary username, sourced
 * from the same public-profile fetch this hook already performs. Additive and
 * desktop-only — the shared `Conversation` type is untouched, so mobile is
 * unaffected. The DM sidebar resolves `name.q` (Model B) from this field.
 */
export type ConversationWithQns = Conversation & { primaryUsername?: string };

export function useConversationsWithProfileBackfill(
  conversations: Conversation[]
): ConversationWithQns[] {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();

  // Fetch every distinct DM partner (small N, unlike a space roster): placeholder
  // rows need name/icon backfill, established rows need primary_username for
  // name.q. Cached 1h, shared with the open-conversation view's query key.
  const addressesToFetch = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const c of conversations) {
      if (!c.address || seen.has(c.address)) continue;
      seen.add(c.address);
      out.push(c.address);
    }
    return out;
  }, [conversations]);

  const queries = useQueries({
    queries: addressesToFetch.map((address) => ({
      queryKey: publicProfileQueryKey(address),
      queryFn: async (): Promise<PublicProfileResponse | null> => {
        try {
          const response = await new QuorumApiClient().getPublicProfile(address);
          return response.data;
        } catch (error: unknown) {
          if (isHandledFetchError(error) && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
      staleTime: 60 * 60 * 1000, // 1 hour — matches useUserPublicProfile
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
    })),
  });

  // address -> resolved public profile (or null). Stable per render via the
  // query data refs, which React Query keeps stable until a refetch.
  const profileByAddress = useMemo(() => {
    const map: Record<string, PublicProfileResponse | null> = {};
    addressesToFetch.forEach((addr, i) => {
      map[addr] = queries[i]?.data ?? null;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressesToFetch, queries.map((q) => q?.data ?? null).join('|')]);

  // Placeholder name/icon fall back to the public profile; real values kept.
  // primary_username is attached whenever the profile was fetched.
  const merged = useMemo((): ConversationWithQns[] => {
    return conversations.map((c) => {
      const pub = profileByAddress[c.address];
      if (!pub) return c;
      const nameNeedsFill = isPlaceholderName(c.displayName);
      const iconNeedsFill = isPlaceholderIcon(c.icon);
      const primaryUsername = pub.primary_username || undefined;
      if (!nameNeedsFill && !iconNeedsFill) {
        return primaryUsername ? { ...c, primaryUsername } : c;
      }
      return {
        ...c,
        displayName:
          nameNeedsFill && pub.display_name ? pub.display_name : c.displayName,
        icon: iconNeedsFill && pub.profile_image ? pub.profile_image : c.icon,
        primaryUsername,
      };
    });
  }, [conversations, profileByAddress]);

  // Write-through: persist resolved values back to IndexedDB so the next load
  // is instant and the conversation view stops flashing. Guard against
  // re-writing the same row repeatedly within a session.
  const writtenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!messageDB) return;
    for (const c of conversations) {
      const pub = profileByAddress[c.address];
      if (!pub) continue;

      const nextName =
        isPlaceholderName(c.displayName) && pub.display_name
          ? pub.display_name
          : undefined;
      const nextIcon =
        isPlaceholderIcon(c.icon) && pub.profile_image
          ? pub.profile_image
          : undefined;
      if (!nextName && !nextIcon) continue;

      // Dedupe writes by the values we're about to persist.
      const writeKey = `${c.conversationId}|${nextName ?? ''}|${nextIcon ?? ''}`;
      if (writtenRef.current.has(writeKey)) continue;
      writtenRef.current.add(writeKey);

      void (async () => {
        try {
          const existing = await messageDB.getConversation({
            conversationId: c.conversationId,
          });
          if (!existing?.conversation) return;
          // Re-check against the freshest stored row: a dm-update-profile
          // broadcast may have landed a real value since we read the list.
          const row = existing.conversation;
          const merged: Conversation = {
            ...row,
            ...(nextName && isPlaceholderName(row.displayName)
              ? { displayName: nextName }
              : {}),
            ...(nextIcon && isPlaceholderIcon(row.icon)
              ? { icon: nextIcon }
              : {}),
          };
          if (
            merged.displayName === row.displayName &&
            merged.icon === row.icon
          ) {
            return; // nothing to persist after the re-check
          }
          await messageDB.saveConversation(merged);
          queryClient.invalidateQueries({
            queryKey: buildConversationsKey({ type: 'direct' }),
          });
          queryClient.invalidateQueries({
            queryKey: buildConversationKey({
              conversationId: c.conversationId,
            }),
          });
        } catch (err) {
          logger.warn('[DMProfileBackfill] write-back failed', {
            err,
            conversationId: c.conversationId,
          });
        }
      })();
    }
  }, [conversations, profileByAddress, messageDB, queryClient]);

  return merged;
}
