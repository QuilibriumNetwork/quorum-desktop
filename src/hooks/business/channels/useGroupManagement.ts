import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSpace } from '../../queries';
import { useMessageDB } from '../../../components/context/useMessageDB';

export function useGroupManagement({
  spaceId,
  groupName,
  onDeleteComplete,
}: {
  spaceId: string;
  groupName?: string;
  onDeleteComplete?: () => void;
}) {
  const { data: space } = useSpace({ spaceId });
  const { channelId } = useParams();
  const navigate = useNavigate();
  const { updateSpace, messageDB } = useMessageDB();

  // Initialize group name state
  const [group, setGroup] = useState<string>(groupName || '');

  // State for deletion flow
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [hasMessages, setHasMessages] = useState<boolean>(false);
  const [hasChannels, setHasChannels] = useState<boolean>(false);
  const [channelCount, setChannelCount] = useState<number>(0);
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [showChannelError, setShowChannelError] = useState<boolean>(false);

  // Sync group name when data loads
  useEffect(() => {
    if (groupName) {
      setGroup(groupName);
    }
  }, [groupName]);

  // Check if group has channels and if any channel in the group has messages
  useEffect(() => {
    const checkGroupChannelsAndMessages = async () => {
      if (groupName && space) {
        try {
          const group = space.groups.find((g) => g.groupName === groupName);
          if (group) {
            const channelCount = group.channels.length;
            setChannelCount(channelCount);
            setHasChannels(channelCount > 0);
            
            // Only check messages if we have messageDB
            if (messageDB && channelCount > 0) {
              for (const channel of group.channels) {
                const messages = await messageDB.getMessages({
                  spaceId,
                  channelId: channel.channelId,
                  limit: 1,
                });
                if (messages.messages.length > 0) {
                  setHasMessages(true);
                  break;
                }
              }
            } else {
              setHasMessages(false);
            }
          } else {
            setChannelCount(0);
            setHasChannels(false);
            setHasMessages(false);
          }
        } catch (error) {
          console.error('Error checking group channels and messages:', error);
        }
      }
    };
    checkGroupChannelsAndMessages();
  }, [groupName, space, spaceId, messageDB]);

  // Handle group name change
  const handleGroupNameChange = useCallback((value: string) => {
    setGroup(value);
  }, []);

  // Save group changes
  const saveChanges = useCallback(async () => {
    if (!space) return;

    // Check if group name is valid and not duplicate
    if (
      !space.groups.find((g) => g.groupName === group) &&
      groupName !== group &&
      group !== ''
    ) {
      if (groupName) {
        // Update existing group
        updateSpace({
          ...space,
          groups: space.groups.map((g) => {
            return {
              ...g,
              groupName: groupName === g.groupName ? group : g.groupName,
            };
          }),
        });
      } else {
        // Create new group
        updateSpace({
          ...space,
          groups: [...space.groups, { groupName: group, channels: [] }],
        });
      }
    }
  }, [space, group, groupName, updateSpace]);

  // Handle delete confirmation
  const handleDeleteClick = useCallback(() => {
    // First check if group has channels - block deletion if it does
    if (hasChannels) {
      setShowChannelError(true);
      // Hide error after 5 seconds
      setTimeout(() => setShowChannelError(false), 5000);
      return;
    }
    
    // If no channels, proceed with simple double-click confirmation
    if (deleteConfirmationStep === 0) {
      setDeleteConfirmationStep(1);
      // Reset confirmation after 5 seconds
      setTimeout(() => setDeleteConfirmationStep(0), 5000);
    } else {
      deleteGroup();
    }
  }, [deleteConfirmationStep, hasChannels]);

  // Delete group
  const deleteGroup = useCallback(async () => {
    if (!groupName || !space) return;

    // Find remaining groups after deletion
    const withoutGroup = space.groups.filter((g) => g.groupName !== groupName);

    // Find a new default channel if current channel is in the deleted group
    const updatedChannelId = withoutGroup.find((g) =>
      g.channels.find((c) => c.channelId === space.defaultChannelId)
    )
      ? space.defaultChannelId
      : withoutGroup.length > 0 && withoutGroup[0].channels.length > 0
        ? withoutGroup[0].channels[0].channelId
        : space.defaultChannelId;

    // Navigate away if current channel is in the deleted group
    if (
      !withoutGroup.find((g) =>
        g.channels.find((c) => c.channelId === channelId)
      )
    ) {
      navigate(`/spaces/${space.spaceId}/${updatedChannelId}`);
    }

    // Update space with removed group
    updateSpace({
      ...space,
      defaultChannelId: updatedChannelId,
      groups: space.groups.filter((g) => g.groupName !== groupName),
    });

    // Call the completion callback (to close modal)
    if (onDeleteComplete) {
      onDeleteComplete();
    }
  }, [groupName, space, channelId, navigate, updateSpace, onDeleteComplete]);

  // Reset delete confirmation state
  const resetDeleteConfirmation = useCallback(() => {
    setDeleteConfirmationStep(0);
    setShowWarning(false);
    setShowChannelError(false);
  }, []);

  // Check if group name is valid for saving
  const isValidGroupName = useCallback(() => {
    if (!space || group === '') return false;

    // Can't save if name hasn't changed
    if (groupName === group) return false;

    // Can't save if name already exists
    if (space.groups.find((g) => g.groupName === group)) return false;

    return true;
  }, [space, group, groupName]);

  return {
    // State
    group,
    hasMessages,
    hasChannels,
    channelCount,
    showWarning,
    showChannelError,
    deleteConfirmationStep,
    isEditMode: !!groupName,
    canSave: isValidGroupName(),

    // Actions
    handleGroupNameChange,
    saveChanges,
    handleDeleteClick,
    setShowWarning,
    setShowChannelError,
    resetDeleteConfirmation,
  };
}
