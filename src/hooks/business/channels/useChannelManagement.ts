import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { Channel } from '../../../api/quorumApi';
import { useSpace } from '../../queries';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useConfirmation } from '../../ui/useConfirmation';
import ChannelPreview from '../../../components/space/ChannelPreview';
import { t } from '@lingui/core/macro';

export interface ChannelData {
  channelName: string;
  channelTopic: string;
  isReadOnly: boolean;
  managerRoleIds: string[];
  isPinned: boolean;
  pinnedAt?: number;
}

export function useChannelManagement({
  spaceId,
  groupName,
  channelId,
  onDeleteComplete,
}: {
  spaceId: string;
  groupName: string;
  channelId?: string;
  onDeleteComplete?: () => void;
}) {
  const { data: space } = useSpace({ spaceId });
  const { channelId: routeChannelId } = useParams();
  const navigate = useNavigate();
  const { updateSpace, createChannel, messageDB } = useMessageDB();

  // Find the current channel
  const currentChannel = space?.groups
    .find((g) => g.groupName === groupName)
    ?.channels.find((c) => c.channelId === channelId);

  // Initialize channel data state
  const [channelData, setChannelData] = useState<ChannelData>({
    channelName: currentChannel?.channelName || '',
    channelTopic: currentChannel?.channelTopic || '',
    isReadOnly: currentChannel?.isReadOnly || false,
    managerRoleIds: currentChannel?.managerRoleIds || [],
    isPinned: currentChannel?.isPinned || false,
    pinnedAt: currentChannel?.pinnedAt,
  });

  // State for deletion flow
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [hasMessages, setHasMessages] = useState<boolean>(false);
  const [messageCount, setMessageCount] = useState<number>(0);

  // Sync channel data when space data loads
  useEffect(() => {
    if (channelId && space) {
      const channel = space.groups
        .find((g) => g.groupName === groupName)
        ?.channels.find((c) => c.channelId === channelId);

      if (channel) {
        setChannelData({
          channelName: channel.channelName || '',
          channelTopic: channel.channelTopic || '',
          isReadOnly: channel.isReadOnly || false,
          managerRoleIds: channel.managerRoleIds || [],
          isPinned: channel.isPinned || false,
          pinnedAt: channel.pinnedAt,
        });
      }
    }
  }, [channelId, space?.spaceId, groupName]);

  // Check if channel has messages and get count
  useEffect(() => {
    const checkMessages = async () => {
      if (channelId && messageDB) {
        try {
          const messages = await messageDB.getMessages({
            spaceId,
            channelId,
            limit: 50, // Get more messages to get a better count
          });
          setHasMessages(messages.messages.length > 0);
          setMessageCount(messages.messages.length);
        } catch (error) {
          console.error('Error checking messages:', error);
        }
      }
    };
    checkMessages();
  }, [channelId, spaceId, messageDB]);

  // Handle channel name change
  const handleChannelNameChange = useCallback((value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9\-]/gi, '');
    setChannelData((prev) => ({ ...prev, channelName: sanitized }));
  }, []);

  // Handle channel topic change
  const handleChannelTopicChange = useCallback((value: string) => {
    setChannelData((prev) => ({ ...prev, channelTopic: value }));
  }, []);

  // Handle read-only toggle
  const handleReadOnlyChange = useCallback((value: boolean) => {
    setChannelData((prev) => ({ ...prev, isReadOnly: value }));
  }, []);

  // Handle manager roles change
  const handleManagerRolesChange = useCallback((value: string | string[]) => {
    const roleIds = Array.isArray(value) ? value : [value];
    setChannelData((prev) => ({ ...prev, managerRoleIds: roleIds }));
  }, []);

  // Handle pin toggle
  const handlePinChange = useCallback((value: boolean) => {
    setChannelData((prev) => ({
      ...prev,
      isPinned: value,
      pinnedAt: value ? Date.now() : undefined,
    }));
  }, []);

  // Save channel changes
  const saveChanges = useCallback(async () => {
    if (!space) return;

    if (channelId) {
      // Update existing channel
      await updateSpace({
        ...space,
        groups: space.groups.map((g) => {
          return {
            ...g,
            channels:
              groupName === g.groupName
                ? g.channels.map((c) =>
                    c.channelId === channelId
                      ? {
                          ...c,
                          channelName: channelData.channelName,
                          channelTopic: channelData.channelTopic,
                          isReadOnly: channelData.isReadOnly,
                          managerRoleIds: channelData.managerRoleIds,
                          isPinned: channelData.isPinned,
                          pinnedAt: channelData.pinnedAt,
                          modifiedDate: Date.now(),
                        }
                      : c
                  )
                : g.channels,
          };
        }),
      });
    } else {
      // Create new channel
      const channelAddress = await createChannel(spaceId);
      await updateSpace({
        ...space,
        groups: space.groups.map((g) => {
          return {
            ...g,
            channels:
              groupName === g.groupName
                ? [
                    ...g.channels,
                    {
                      channelId: channelAddress,
                      spaceId: spaceId,
                      channelName: channelData.channelName,
                      channelTopic: channelData.channelTopic,
                      isReadOnly: channelData.isReadOnly,
                      managerRoleIds: channelData.managerRoleIds,
                      isPinned: channelData.isPinned,
                      pinnedAt: channelData.pinnedAt,
                      createdDate: Date.now(),
                      modifiedDate: Date.now(),
                    } as Channel,
                  ]
                : g.channels,
          };
        }),
      });
    }
  }, [
    space,
    channelData,
    channelId,
    groupName,
    spaceId,
    updateSpace,
    createChannel,
  ]);

  // Confirmation hook for channel delete with smart escalation
  const deleteConfirmation = useConfirmation({
    type: 'inline',
    escalateWhen: () => hasMessages, // Escalate to modal if channel has messages
    enableShiftBypass: false, // Disable shift bypass for channel deletion
    modalConfig: hasMessages ? {
      title: t`Delete Channel`,
      message: t`Are you sure you want to delete this channel? All messages will be lost. This action cannot be undone.`,
      preview: React.createElement(ChannelPreview, { 
        channelName: channelData.channelName, 
        messageCount 
      }),
      confirmText: t`Delete`,
      cancelText: t`Cancel`,
      variant: 'danger',
    } : undefined,
  });

  // Handle delete with smart escalation
  const handleDeleteClick = useCallback((e?: React.MouseEvent) => {
    const performDelete = () => {
      deleteChannel();
      setDeleteConfirmationStep(0);
    };
    
    if (e) {
      // Event-based call (from button click) - use new confirmation system
      deleteConfirmation.handleClick(e, performDelete);
    } else {
      // Legacy call without event - fall back to old double-click system
      if (deleteConfirmationStep === 0) {
        setDeleteConfirmationStep(1);
        // Reset confirmation after 5 seconds
        setTimeout(() => setDeleteConfirmationStep(0), 5000);
      } else {
        performDelete();
      }
    }
  }, [deleteConfirmation, deleteConfirmationStep]);

  // Delete channel
  const deleteChannel = useCallback(async () => {
    if (!channelId || !space) return;

    // Find a new default channel if we're deleting the current default
    const updatedChannelId =
      space.defaultChannelId === channelId
        ? (space.groups
            .find((g) => g.channels.find((c) => c.channelId !== channelId))
            ?.channels.find((c) => c.channelId !== channelId)?.channelId ??
          space.defaultChannelId)
        : space.defaultChannelId;

    // Navigate away if we're deleting the current channel
    if (routeChannelId === channelId) {
      navigate(`/spaces/${spaceId}/${updatedChannelId}`);
    }

    // Update space with removed channel
    updateSpace({
      ...space,
      defaultChannelId: updatedChannelId,
      groups: space.groups.map((g) => {
        return {
          ...g,
          channels: g.channels.filter((c) => c.channelId !== channelId),
        };
      }),
    });

    // Call the completion callback (to close modal)
    if (onDeleteComplete) {
      onDeleteComplete();
    }
  }, [
    channelId,
    space,
    routeChannelId,
    spaceId,
    navigate,
    updateSpace,
    onDeleteComplete,
  ]);

  // Reset delete confirmation state
  const resetDeleteConfirmation = useCallback(() => {
    setDeleteConfirmationStep(0);
  }, []);

  return {
    // State
    channelName: channelData.channelName,
    channelTopic: channelData.channelTopic,
    isReadOnly: channelData.isReadOnly,
    managerRoleIds: channelData.managerRoleIds,
    isPinned: channelData.isPinned,
    pinnedAt: channelData.pinnedAt,
    hasMessages,
    messageCount,
    deleteConfirmationStep,
    isEditMode: !!channelId,
    availableRoles: space?.roles || [],

    // Actions
    handleChannelNameChange,
    handleChannelTopicChange,
    handleReadOnlyChange,
    handleManagerRolesChange,
    handlePinChange,
    saveChanges,
    handleDeleteClick,
    resetDeleteConfirmation,
    deleteConfirmation,
  };
}
