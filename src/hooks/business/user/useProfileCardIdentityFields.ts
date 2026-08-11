// useProfileCardIdentityFields — the profile card's avatar and bio, resolved
// from the ADDRESS rather than from whatever the caller happened to pass.
//
// The card has two entry points carrying different payloads: a message-avatar
// click hands over a fully-merged member record (`Message.tsx`'s `onUserClick`),
// a mention-pill click hands over an address and nothing else
// (`MessageMarkdownRenderer.tsx`'s `handleClick` — deliberately, because the
// NAME resolves from `src/identity` either way).
//
// The name survived that narrowing; the avatar and bio did not. They are not
// names, so the identity module deliberately does not carry them (design
// constraint 4 — `MemberName` takes `userIcon` as a caller-supplied prop), and
// the card's own address-keyed fallback went straight to the published public
// profile. That SKIPS the tier the rest of the app actually renders from:
// `space_members`' per-space override and its live-pushed
// `global_user_icon` / `global_bio` slots, written by the identity announce
// (`MessageDB.tsx`) and merged for every other surface by `useChannelData`.
// The public profile is opt-in, frequently absent, and cached for an hour — so
// the same person's card opened from a mention showed a stale bio and, for
// anyone who never published a public photo, no avatar at all, while their card
// opened from a message avatar one click away showed both.
//
// The ladder below is the SAME one `useChannelData` applies when it builds that
// member record, and the same one `pickBookmarkSenderIcon` applies for
// bookmarks: local tiers first, because they are live-pushed and work for
// members with no public profile at all; the public profile last.
//
// Cost: none in the channel case. The roster read below uses
// `buildSpaceMembersKey`, the key `Channel` (via `useSpaceMembers`) and
// `useMultiSpaceRosters` have already populated — a cache read, not a second
// IndexedDB round trip. Checking the key before asserting a cost is the
// standing lesson from the identity work; see
// `.agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md`.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DefaultImages } from '../../../utils';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { buildSpaceMembersFetcher } from '../../queries/spaceMembers/buildSpaceMembersFetcher';
import { buildSpaceMembersKey } from '../../queries/spaceMembers/buildSpaceMembersKey';

/**
 * One rung of the avatar ladder: a usable avatar, or `undefined` so the next
 * rung — and ultimately the initials placeholder — can take over. Mirrors
 * `useChannelData`'s `pickAvatar`; the default UNKNOWN_USER image counts as
 * absent, because handing it on renders a broken-looking placeholder instead
 * of initials.
 */
function pickAvatar(icon: string | undefined): string | undefined {
  if (!icon) return undefined;
  return icon.includes(DefaultImages.UNKNOWN_USER) ? undefined : icon;
}

/** Blank and whitespace-only strings are "no value", not a value. */
function nn(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? value : undefined;
}

/** Every place the card's avatar and bio can come from, already read. */
export interface ProfileCardFieldSources {
  /**
   * What the caller passed on `props.user`. PRE-FILL ONLY: present on the
   * message-avatar and sidebar paths, absent on the mention-pill path. It is
   * itself a snapshot of the two member tiers below, so it ranks first purely
   * to avoid a flash while the roster read settles — never as the only source.
   */
  callerIcon?: string;
  callerBio?: string;
  /** `space_members.user_icon` / `.bio` — the deliberate per-space override. */
  memberIcon?: string;
  memberBio?: string;
  /** `space_members.global_user_icon` / `.global_bio` — the live-pushed global
   *  identity. The tier that was missing, and where most members' avatar and
   *  bio actually live under the two-slot model. */
  memberGlobalIcon?: string;
  memberGlobalBio?: string;
  /** The published public profile: opt-in, often empty, cached one hour. */
  publicProfileIcon?: string;
  publicProfileBio?: string;
  /** `UserConfig.bio` — self only, so clearing a per-space bio override
   *  reveals your global one again instead of an empty section. */
  ownConfigBio?: string;
}

/**
 * Pure precedence rules, kept out of the hook so they can be tested without
 * IndexedDB, the network, or mounting a component with sixteen hooks.
 */
export function pickProfileCardIcon(
  sources: ProfileCardFieldSources
): string | undefined {
  return (
    pickAvatar(sources.callerIcon) ??
    pickAvatar(sources.memberIcon) ??
    pickAvatar(sources.memberGlobalIcon) ??
    pickAvatar(sources.publicProfileIcon)
  );
}

export function pickProfileCardBio(
  sources: ProfileCardFieldSources
): string | undefined {
  return (
    nn(sources.callerBio) ??
    nn(sources.memberBio) ??
    nn(sources.memberGlobalBio) ??
    nn(sources.publicProfileBio) ??
    nn(sources.ownConfigBio)
  );
}

export interface UseProfileCardIdentityFieldsArgs {
  address: string;
  /** Absent in a DM, where there is no roster to read — the caller value and
   *  the public profile are then the only tiers, exactly as before. */
  spaceId?: string;
  callerIcon?: string;
  callerBio?: string;
  publicProfileIcon?: string;
  publicProfileBio?: string;
  ownConfigBio?: string;
}

export function useProfileCardIdentityFields({
  address,
  spaceId,
  callerIcon,
  callerBio,
  publicProfileIcon,
  publicProfileBio,
  ownConfigBio,
}: UseProfileCardIdentityFieldsArgs): { userIcon?: string; bio?: string } {
  const { messageDB } = useMessageDB();

  const { data: members } = useQuery({
    queryKey: buildSpaceMembersKey({ spaceId: spaceId ?? '' }),
    queryFn: buildSpaceMembersFetcher({ spaceId: spaceId ?? '', messageDB }),
    enabled: !!spaceId,
    networkMode: 'always', // IndexedDB, not the network
    staleTime: 60 * 1000,
  });

  // `SpaceMemberRow` is the raw IndexedDB shape (SDK field names), NOT
  // quorum-shared's `SpaceMember` — so `user_address`/`user_icon` here, never
  // `address`/`profile_image`. That rawness is the point: this is the same
  // row `useChannelData` reads, before any adapter mapping.
  const member = useMemo(
    () => members?.find((m) => m.user_address === address),
    [members, address]
  );

  return useMemo(() => {
    const sources: ProfileCardFieldSources = {
      callerIcon,
      callerBio,
      memberIcon: member?.user_icon || undefined,
      memberBio: member?.bio || undefined,
      memberGlobalIcon: member?.global_user_icon || undefined,
      memberGlobalBio: member?.global_bio || undefined,
      publicProfileIcon,
      publicProfileBio,
      ownConfigBio,
    };
    return {
      userIcon: pickProfileCardIcon(sources),
      bio: pickProfileCardBio(sources),
    };
  }, [
    member,
    callerIcon,
    callerBio,
    publicProfileIcon,
    publicProfileBio,
    ownConfigBio,
  ]);
}
