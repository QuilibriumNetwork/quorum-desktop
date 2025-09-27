import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  usePasskeysContext,
  channel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { useConversations, useRegistration } from '../../queries';
import { Conversation, Channel } from '../../../api/quorumApi';
import { truncateAddress } from '../../../utils';
import { t } from '@lingui/core/macro';

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
  invite: (address: string) => Promise<void>;

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

  // Hooks
  const { currentPasskeyInfo } = usePasskeysContext();
  const {
    messageDB,
    ensureKeyForSpace,
    sendInviteToUser,
    generateNewInviteLink: generateInviteLink,
  } = useMessageDB();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { data: conversations } = useConversations({ type: 'direct' });
  const { apiClient } = useQuorumApiClient();
  const navigate = useNavigate();

  // Get user options for dropdown
  const getUserOptions = useCallback(() => {
    if (!conversations?.pages) return [];
    return conversations.pages
      .flatMap((c: any) => c.conversations as Conversation[])
      .toReversed()
      .map((conversation) => ({
        value: conversation.address,
        label: conversation.displayName,
        avatar: conversation.icon,
        subtitle: truncateAddress(conversation.address),
      }));
  }, [conversations]);

  // Resolve manual address input
  useEffect(() => {
    (async () => {
      if (manualAddress?.length === 46) {
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

  // Send invite function
  const invite = useCallback(
    async (address: string) => {
      setSendingInvite(true);
      setSuccess(false);
      setMembershipWarning(undefined);

      try {
        // Check if user is already a member of this space
        const existingMember = await messageDB.getSpaceMember(spaceId, address);
        if (existingMember && existingMember.inbox_address && existingMember.inbox_address !== '') {
          setMembershipWarning(t`This user is already a member of this space.`);
          return;
        }

        const spaceAddress = await ensureKeyForSpace(
          currentPasskeyInfo!.address,
          space!
        );
        if (spaceAddress !== spaceId && defaultChannel) {
          navigate('/spaces/' + spaceAddress + '/' + defaultChannel.channelId);
        }

        await sendInviteToUser(address, spaceAddress, currentPasskeyInfo!);
        setSuccess(true);
      } catch (error) {
        console.error('Invite error:', error);
        setMembershipWarning(t`Failed to send invite. Please try again.`);
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
    invite,

    publicInvite,
    setPublicInvite,
    generating,
    generateNewInviteLink,
  };
};
