import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSpace } from '../../queries';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { IconName } from '../../../components/primitives/Icon/types';
import { IconColor } from '../../../components/space/IconPicker';

export interface GroupData {
  groupName: string;
  icon?: IconName;
  iconColor?: IconColor;
}

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

  // Find the current group
  const currentGroup = space?.groups.find((g) => g.groupName === groupName);

  // Initialize group data state
  const [groupData, setGroupData] = useState<GroupData>({
    groupName: groupName || '',
    icon: currentGroup?.icon as IconName | undefined,
    iconColor: (currentGroup?.iconColor as IconColor) || 'default',
  });

  // State for deletion flow
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [hasMessages, setHasMessages] = useState<boolean>(false);
  const [hasChannels, setHasChannels] = useState<boolean>(false);
  const [channelCount, setChannelCount] = useState<number>(0);
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [showChannelError, setShowChannelError] = useState<boolean>(false);

  // Sync group data when space data loads
  useEffect(() => {
    if (groupName && space) {
      const group = space.groups.find((g) => g.groupName === groupName);
      if (group) {
        setGroupData({
          groupName: group.groupName || '',
          icon: group.icon as IconName | undefined,
          iconColor: (group.iconColor as IconColor) || 'default',
        });
      }
    }
  }, [groupName, space?.spaceId]);

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
    // Remove only truly problematic characters (filesystem/URL unsafe), allow emojis and Unicode
    const sanitized = value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
    setGroupData((prev) => ({ ...prev, groupName: sanitized }));
  }, []);

  // Handle icon change
  const handleIconChange = useCallback((iconName: IconName | null, iconColor: IconColor = 'default') => {
    setGroupData((prev) => ({
      ...prev,
      icon: iconName || undefined,
      iconColor: iconColor,
    }));
  }, []);

  // Save group changes
  const saveChanges = useCallback(async () => {
    if (!space) return;

    if (groupName) {
      // Update existing group
      await updateSpace({
        ...space,
        groups: space.groups.map((g) => {
          return groupName === g.groupName ? {
            ...g,
            groupName: groupData.groupName,
            icon: groupData.icon,
            iconColor: groupData.iconColor,
          } : g;
        }),
      });
    } else {
      // Create new group - must have valid name
      if (groupData.groupName !== '' && !space.groups.find((g) => g.groupName === groupData.groupName)) {
        await updateSpace({
          ...space,
          groups: [...space.groups, {
            groupName: groupData.groupName,
            icon: groupData.icon,
            iconColor: groupData.iconColor,
            channels: []
          }],
        });
      }
    }
  }, [space, groupData, groupName, updateSpace]);

  // Handle delete confirmation
  const handleDeleteClick = useCallback(() => {
    // First check if group has channels - block deletion if it does
    if (hasChannels) {
      setShowChannelError(true);
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

  // Check if changes can be saved
  const canSaveChanges = useCallback(() => {
    if (!space) return false;

    if (groupName) {
      // For existing groups: always allow saving (like ChannelEditor)
      return true;
    } else {
      // For new groups: must have valid name that doesn't already exist
      return groupData.groupName !== '' && !space.groups.find((g) => g.groupName === groupData.groupName);
    }
  }, [space, groupData.groupName, groupName]);

  return {
    // State
    group: groupData.groupName, // For backward compatibility
    icon: groupData.icon,
    iconColor: groupData.iconColor,
    hasMessages,
    hasChannels,
    channelCount,
    showWarning,
    showChannelError,
    deleteConfirmationStep,
    isEditMode: !!groupName,
    canSave: canSaveChanges(),

    // Actions
    handleGroupNameChange,
    handleIconChange,
    saveChanges,
    handleDeleteClick,
    setShowWarning,
    setShowChannelError,
    resetDeleteConfirmation,
  };
}
