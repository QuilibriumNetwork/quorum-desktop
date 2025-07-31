import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Channel } from '../../../api/quorumApi';
import { useSpace } from '../../queries';
import { useMessageDB } from '../../../components/context/MessageDB';

export interface ChannelData {
  channelName: string;
  channelTopic: string;
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
  });

  // State for deletion flow
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [hasMessages, setHasMessages] = useState<boolean>(false);
  const [showWarning, setShowWarning] = useState<boolean>(false);

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
        });
      }
    }
  }, [channelId, space?.spaceId, groupName]);

  // Check if channel has messages
  useEffect(() => {
    const checkMessages = async () => {
      if (channelId && messageDB) {
        try {
          const messages = await messageDB.getMessages({
            spaceId,
            channelId,
            limit: 1,
          });
          setHasMessages(messages.messages.length > 0);
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
    setChannelData(prev => ({ ...prev, channelName: sanitized }));
  }, []);

  // Handle channel topic change
  const handleChannelTopicChange = useCallback((value: string) => {
    setChannelData(prev => ({ ...prev, channelTopic: value }));
  }, []);

  // Save channel changes
  const saveChanges = useCallback(async () => {
    if (!space) return;

    if (channelId) {
      // Update existing channel
      updateSpace({
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
      updateSpace({
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
                      createdDate: Date.now(),
                      modifiedDate: Date.now(),
                    } as Channel,
                  ]
                : g.channels,
          };
        }),
      });
    }
  }, [space, channelData, channelId, groupName, spaceId, updateSpace, createChannel]);

  // Handle delete confirmation
  const handleDeleteClick = useCallback(() => {
    if (deleteConfirmationStep === 0) {
      setDeleteConfirmationStep(1);
      if (hasMessages) {
        setShowWarning(true);
      }
      // Reset confirmation after 5 seconds
      setTimeout(() => setDeleteConfirmationStep(0), 5000);
    } else {
      deleteChannel();
    }
  }, [deleteConfirmationStep, hasMessages]);

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
  }, [channelId, space, routeChannelId, spaceId, navigate, updateSpace, onDeleteComplete]);

  // Reset delete confirmation state
  const resetDeleteConfirmation = useCallback(() => {
    setDeleteConfirmationStep(0);
    setShowWarning(false);
  }, []);

  return {
    // State
    channelName: channelData.channelName,
    channelTopic: channelData.channelTopic,
    hasMessages,
    showWarning,
    deleteConfirmationStep,
    isEditMode: !!channelId,

    // Actions
    handleChannelNameChange,
    handleChannelTopicChange,
    saveChanges,
    handleDeleteClick,
    setShowWarning,
    resetDeleteConfirmation,
  };
}