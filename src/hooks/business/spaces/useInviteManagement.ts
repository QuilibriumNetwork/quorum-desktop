import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  usePasskeysContext,
  channel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { useConversations, useRegistration } from '../../queries';
import { isValidIPFSCID, formatAddress, type Conversation, type Channel } from '@quilibrium/quorum-shared';
import { t } from '@lingui/core/macro';
import { InviteEvalsExhaustedError } from '../../../services/InvitationService';
import { resolveMemberName, formatResolvedName } from '../../../utils/resolveMemberName';
import { useConversationsWithProfileBackfill } from '../conversations/useConversationsWithProfileBackfill';

export interface UseInviteManagementOptions {
  spaceId: string;
  space?: any;
  defaultChannel?: Channel;
}

export interface UseInviteManagementReturn {
  // User selection
  selectedUser: Conversation | undefined;
  setSelectedUser: (user: Conversation | undefined) => void;
  manualAddress: string;
  setManualAddress: (address: string) => void;
  resolvedUser: channel.UserRegistration | undefined;
  getUserOptions: () => any[];

  // Invite management
  sendingInvite: boolean;
  success: boolean;
  membershipWarning: string | undefined;
  // True when this space's local invite-evals pool is empty — typically a
  // legacy state from before the 2026-06-07 consolidation. UI uses this to
  // render a friendly banner instead of throwing on the next operation.
  poolExhausted: boolean;
  // `mode` selects what link to send:
  //  - 'one-time' (default): generate a fresh link from the pool, consume one eval.
  //  - 'public': forward the space's existing public inviteUrl.
  //  - 'reuse': send the explicit `presetLink` (e.g. a one-time link the user
  //    already generated via the Generate Invite Link button); no eval is
  //    consumed.
  invite: (
    address: string,
    mode?: 'one-time' | 'public' | 'reuse',
    presetLink?: string
  ) => Promise<void>;
  // Generate a fresh one-time invite URL and return it (no DM send). Consumes
  // one eval from the local pool. The UI uses this for the "I want the link
  // to share outside Quorum" case.
  generateOneTimeLink: () => Promise<string | null>;
  generatedOneTimeLink: string | null;
  clearGeneratedOneTimeLink: () => void;
  generatingOneTimeLink: boolean;
  generateOneTimeLinkError: string | undefined;

  // Public invite link
  publicInvite: boolean;
  setPublicInvite: (isPublic: boolean) => void;
  generating: boolean;
  generateNewInviteLink: () => Promise<void>;
}

export const useInviteManagement = (
  options: UseInviteManagementOptions
): UseInviteManagementReturn => {
  const { spaceId, space, defaultChannel } = options;

  // State
  const [selectedUser, setSelectedUser] = useState<Conversation | undefined>();
  const [manualAddress, setManualAddress] = useState<string>('');
  const [resolvedUser, setResolvedUser] = useState<
    channel.UserRegistration | undefined
  >();
  const [sendingInvite, setSendingInvite] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [membershipWarning, setMembershipWarning] = useState<string | undefined>();
  const [generating, setGenerating] = useState<boolean>(false);
  const [publicInvite, setPublicInvite] = useState<boolean>(
    space?.isPublic || false
  );
  const [poolExhausted, setPoolExhausted] = useState<boolean>(false);
  const [generatedOneTimeLink, setGeneratedOneTimeLink] = useState<string | null>(null);
  const [generatingOneTimeLink, setGeneratingOneTimeLink] = useState<boolean>(false);
  const [generateOneTimeLinkError, setGenerateOneTimeLinkError] = useState<string | undefined>();

  // Hooks
  const { currentPasskeyInfo } = usePasskeysContext();
  const {
    messageDB,
    ensureKeyForSpace,
    sendInviteToUser,
    generateNewInviteLink: generateInviteLink,
    constructInviteLink,
  } = useMessageDB();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { data: conversations } = useConversations({ type: 'direct' });
  const { apiClient } = useQuorumApiClient();
  const navigate = useNavigate();

  const directConversations = useMemo(
    () =>
      (conversations?.pages ?? [])
        .flatMap((c: any) => c.conversations as Conversation[])
        .toReversed(),
    [conversations],
  );

  // Same backfill the DM sidebar uses, for the same reason: `primary_username`
  // lives only in the public profile, so a raw conversation row cannot carry a
  // QNS name.
  //
  // This costs nothing in practice despite being N lookups. The backfill keys on
  // `publicProfileQueryKey` with a 1h staleTime, and the addresses here are the
  // DM partners the sidebar has already fetched under that exact key — so this
  // is a cache read, not a second round of requests.
  const enrichedConversations = useConversationsWithProfileBackfill(directConversations);

  // Get user options for dropdown
  const getUserOptions = useCallback(() => {
    // A conversation row's `displayName` is a name off the wire, so it goes
    // through the resolver like every other name. This dropdown is where you
    // choose who to hand a Space invite to, and it used to render the raw field.
    return enrichedConversations.map((conversation) => {
      const label = formatResolvedName(
        resolveMemberName({
          address: conversation.address,
          displayName: conversation.displayName,
          primaryUsername: conversation.primaryUsername,
        }),
      );
      return {
        value: conversation.address,
        label,
        avatar: conversation.icon,
        displayName: label,                     // For user initials fallback
        userAddress: conversation.address,      // For deterministic color generation
        subtitle: formatAddress(conversation.address),
      };
    });
  }, [enrichedConversations]);

  // Resolve manual address input
  useEffect(() => {
    (async () => {
      if (manualAddress && isValidIPFSCID(manualAddress)) {
        try {
          const reg = await apiClient.getUser(manualAddress);
          if (reg.data) {
            setResolvedUser(reg.data);
          }
        } catch {
          setResolvedUser(undefined);
        }
      } else {
        setResolvedUser(undefined);
      }
    })();
  }, [manualAddress, apiClient]);

  // Proactively detect a depleted local evals pool so the UI can warn the
  // user up-front instead of failing mid-operation. Same check that
  // InvitationService runs internally.
  useEffect(() => {
    if (!spaceId || !messageDB) return;
    let cancelled = false;
    (async () => {
      try {
        const states = await messageDB.getEncryptionStates({
          conversationId: spaceId + '/' + spaceId,
        });
        if (cancelled) return;
        if (!states || states.length === 0) {
          setPoolExhausted(false);
          return;
        }
        const sets = JSON.parse(states[0].state);
        const exhausted = !sets?.evals || sets.evals.length === 0;
        setPoolExhausted(exhausted);
      } catch {
        if (!cancelled) setPoolExhausted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, messageDB]);

  // Send invite function
  const invite = useCallback(
    async (
      address: string,
      mode: 'one-time' | 'public' | 'reuse' = 'one-time',
      presetLink?: string
    ) => {
      setSendingInvite(true);
      setSuccess(false);
      setMembershipWarning(undefined);

      try {
        // Check if user is already a member of this space
        const existingMember = await messageDB.getSpaceMember(spaceId, address);
        if (
            existingMember
            && existingMember.inbox_address
            && existingMember.inbox_address !== ''
            && !existingMember.isKicked
        ) {
          setMembershipWarning(t`This user is already a member of this Space.`);
          return;
        }

        const spaceAddress = await ensureKeyForSpace(
          currentPasskeyInfo!.address,
          space!
        );
        if (spaceAddress !== spaceId && defaultChannel) {
          navigate('/spaces/' + spaceAddress + '/' + defaultChannel.channelId);
        }

        await sendInviteToUser(address, spaceAddress, currentPasskeyInfo!, mode, presetLink);
        setSuccess(true);
      } catch (error) {
        console.error('Invite error:', error);
        if (error instanceof InviteEvalsExhaustedError) {
          setPoolExhausted(true);
        } else {
          setMembershipWarning(t`Failed to send invite. Please try again.`);
        }
      } finally {
        setSendingInvite(false);
      }
    },
    [
      messageDB,
      spaceId,
      ensureKeyForSpace,
      currentPasskeyInfo,
      space,
      defaultChannel,
      navigate,
      sendInviteToUser,
    ]
  );

  // Generate new invite link
  const generateNewInviteLink = useCallback(async () => {
    if (!space || !registration?.registration) return;

    setGenerating(true);
    try {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 200));
      await generateInviteLink(
        space.spaceId,
        keyset.userKeyset,
        keyset.deviceKeyset,
        registration.registration!
      );
    } finally {
      setGenerating(false);
    }
  }, [space, registration, keyset, generateInviteLink]);

  // Generate a fresh one-time invite URL without sending. Used by the
  // "Generate Link" action in one-time mode for the share-outside-Quorum
  // case. Each call consumes one local eval, just like sending one.
  const generateOneTimeLink = useCallback(async () => {
    if (!space) return null;
    setGeneratingOneTimeLink(true);
    setGenerateOneTimeLinkError(undefined);
    try {
      const spaceAddress = await ensureKeyForSpace(
        currentPasskeyInfo!.address,
        space
      );
      const link = await constructInviteLink(spaceAddress);
      setGeneratedOneTimeLink(link);
      return link;
    } catch (error) {
      console.error('Generate one-time link error:', error);
      if (error instanceof InviteEvalsExhaustedError) {
        setPoolExhausted(true);
      } else {
        setGenerateOneTimeLinkError(
          t`Failed to generate invite link. Please try again.`
        );
      }
      return null;
    } finally {
      setGeneratingOneTimeLink(false);
    }
  }, [space, ensureKeyForSpace, currentPasskeyInfo, constructInviteLink]);

  const clearGeneratedOneTimeLink = useCallback(() => {
    setGeneratedOneTimeLink(null);
    setGenerateOneTimeLinkError(undefined);
  }, []);

  return {
    selectedUser,
    setSelectedUser,
    manualAddress,
    setManualAddress,
    resolvedUser,
    getUserOptions,

    sendingInvite,
    success,
    membershipWarning,
    poolExhausted,
    invite,

    generateOneTimeLink,
    generatedOneTimeLink,
    clearGeneratedOneTimeLink,
    generatingOneTimeLink,
    generateOneTimeLinkError,

    publicInvite,
    setPublicInvite,
    generating,
    generateNewInviteLink,
  };
};
