// useBookmarkSenderIcon — resolve a bookmarked message's sender avatar at
// RENDER time, from `cachedPreview.senderAddress`.
//
// Bookmarks used to carry the avatar itself, as a base64 data URI copied into
// every bookmark. Measured 2026-08-05: 619.8 KB across 18 bookmarks, 69% of the
// entire encrypted config blob, against a ~1 MB working ceiling on the one
// transport that syncs every setting between a user's devices. The bytes are
// gone (see `stripBookmarkSenderIcons` in quorum-shared); the address stays,
// and the avatar is looked up here instead.
//
// The ladder is the same one every other surface uses
// (`useMembersWithPublicProfileFallback`): per-space override → roster global
// slot → public profile, with the DM conversation record standing in for the
// roster on DM bookmarks. A miss is not an error — `UserAvatar` renders
// coloured initials, which is what a sender with no avatar has always shown.
//
// Side benefit: a bookmarked sender's avatar now FOLLOWS a rename or a new
// profile picture, instead of being frozen at the moment you bookmarked them.

import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Bookmark } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useUserPublicProfile } from '../user/useUserPublicProfile';

/** Every place a sender's avatar can come from, already read. */
export interface BookmarkSenderIconSources {
  /** `space_members.user_icon` — the deliberate per-space override. Read by
   *  (spaceId, senderAddress), so it always belongs to the sender. */
  memberIcon?: string;
  /** `space_members.global_user_icon` — the live-pushed global identity. */
  memberGlobalIcon?: string;
  /**
   * The DM conversation record, NOT an avatar.
   *
   * 🔴 `conversation.icon` is the COUNTERPART's avatar — a conversation is
   * keyed by the partner's address and carries the partner's identity. It is
   * passed whole rather than pre-extracted so the rule below can check who the
   * bookmarked message is actually from. Bookmarking your OWN message in a DM
   * is ordinary, and using this blindly renders your name beside the other
   * person's face. A group conversation's icon belongs to no member at all.
   */
  conversation?: { address?: string; icon?: string };
  /** This device's own avatar, used when the bookmarked sender is us. */
  selfIcon?: string;
  /** `profile_image` from the published public profile (opt-in, often absent). */
  publicProfileIcon?: string;
}

/**
 * Pure precedence rule. Kept separate from the queries so it can be tested
 * without IndexedDB or the network.
 *
 * Local sources outrank the public profile deliberately: the public profile is
 * opt-in (off by default) and cached for an hour, whereas the roster global
 * slot is live-pushed and works for non-public users too.
 */
export function pickBookmarkSenderIcon(
  senderAddress: string,
  sources: BookmarkSenderIconSources
): string | undefined {
  // Only usable when the conversation's counterpart IS the sender.
  const conversationIcon =
    senderAddress && sources.conversation?.address === senderAddress
      ? sources.conversation.icon
      : undefined;

  return (
    sources.memberIcon ||
    sources.memberGlobalIcon ||
    conversationIcon ||
    sources.selfIcon ||
    sources.publicProfileIcon ||
    undefined
  );
}

/** The locally-stored half of the ladder — one IndexedDB read, no network. */
export const buildBookmarkSenderLocalKey = (
  scopeId: string,
  senderAddress: string
) => ['bookmarkSenderIcon', scopeId, senderAddress] as const;

export function useBookmarkSenderIcon(bookmark: Bookmark): string | undefined {
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  const senderAddress = bookmark.cachedPreview.senderAddress || '';
  const { spaceId, conversationId, sourceType } = bookmark;
  const scopeId = (sourceType === 'channel' ? spaceId : conversationId) || '';

  const localEnabled = !!senderAddress && !!scopeId;

  const { data: local, isFetched: localFetched } = useQuery({
    queryKey: buildBookmarkSenderLocalKey(scopeId, senderAddress),
    queryFn: async (): Promise<BookmarkSenderIconSources> => {
      if (sourceType === 'channel' && spaceId) {
        const member = await messageDB.getSpaceMember(spaceId, senderAddress);
        return {
          memberIcon: member?.user_icon || undefined,
          memberGlobalIcon: member?.global_user_icon || undefined,
        };
      }
      if (conversationId) {
        const { conversation } = await messageDB.getConversation({ conversationId });
        // Handed over whole — `pickBookmarkSenderIcon` decides whether this
        // conversation's identity is the sender's at all.
        return conversation
          ? { conversation: { address: conversation.address, icon: conversation.icon } }
          : {};
      }
      return {};
    },
    enabled: localEnabled,
    networkMode: 'always', // IndexedDB, not the network
    staleTime: 60 * 1000,
  });

  const selfIcon =
    senderAddress && senderAddress === currentPasskeyInfo?.address
      ? currentPasskeyInfo?.pfpUrl || undefined
      : undefined;

  const localIcon = pickBookmarkSenderIcon(senderAddress, { ...local, selfIcon });

  // Only reach for the network once the local read has SETTLED and produced
  // nothing. Waiting on `isFetched` is the whole point: on the first render
  // `local` is undefined simply because the read is in flight, so gating on
  // `!localIcon` alone fires the request every time and the fallback stops
  // being a fallback. Bookmarks render as a flat list of up to MAX_BOOKMARKS
  // with no virtualization, so that is one public-profile request per distinct
  // sender the moment the page opens. Measured by
  // `bookmarkSenderIconResolution.unit.test.tsx`, which caught exactly this.
  //
  // `!localEnabled` covers a bookmark with no space or conversation to read
  // from: nothing local can ever answer, so go straight to the network.
  const localSettled = !localEnabled || localFetched;
  const { data: publicProfile } = useUserPublicProfile(senderAddress, {
    enabled: !!senderAddress && localSettled && !localIcon,
  });

  return pickBookmarkSenderIcon(senderAddress, {
    ...local,
    selfIcon,
    publicProfileIcon: publicProfile?.profile_image || undefined,
  });
}
