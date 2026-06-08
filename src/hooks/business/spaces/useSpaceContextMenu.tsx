import * as React from 'react';
import { t } from '@lingui/core/macro';
import { useQueryClient } from '@tanstack/react-query';
import ContextMenu, { type MenuItem } from '../../../components/ui/ContextMenu';
import { useModals } from '../../../components/context/ModalProvider';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useChannelMute } from '../channels/useChannelMute';
import { useSpaceLeaving } from './useSpaceLeaving';
import { useSpaces } from '../../queries/spaces/useSpaces';

interface SpaceContextMenuState {
  spaceId: string | null;
  spaceName: string;
  iconUrl?: string;
  isOwner: boolean;
  /** True when `space.inviteUrl` is set. Non-owners only see the
   *  "Invite Members" entry when this is true (it deep-links to the
   *  read-only Invites tab — see #29 in port-from-mobile/candidates.md). */
  hasPublicInvite: boolean;
  position: { x: number; y: number };
  hasNotifications: boolean;
}

const EMPTY_STATE: SpaceContextMenuState = {
  spaceId: null,
  spaceName: '',
  iconUrl: undefined,
  isOwner: false,
  hasPublicInvite: false,
  position: { x: 0, y: 0 },
  hasNotifications: false,
};

interface UseSpaceContextMenuOptions {
  /** Optional callback fired when the menu opens/closes (e.g. to coordinate tooltip suppression). */
  onOpenChange?: (isOpen: boolean) => void;
}

interface UseSpaceContextMenuReturn {
  /** Attach to an element's `onContextMenu` handler. Resolves owner status asynchronously. */
  openContextMenu: (args: {
    spaceId: string;
    spaceName: string;
    iconUrl?: string;
    event: React.MouseEvent;
    hasNotifications?: boolean;
  }) => Promise<void>;
  /** Render the menu (or nothing). Drop into the consumer's JSX tree. */
  contextMenu: React.ReactNode;
}

/**
 * Reusable space context menu — same menu the navbar shows on right-click,
 * extracted so other surfaces (e.g. the My Spaces tab grid) can mount it.
 *
 * Renders nothing until `openContextMenu` is called. The menu closes itself
 * on outside click / Escape via the underlying `ContextMenu` primitive.
 */
export function useSpaceContextMenu(
  options: UseSpaceContextMenuOptions = {}
): UseSpaceContextMenuReturn {
  const { onOpenChange } = options;
  const [state, setState] = React.useState<SpaceContextMenuState>(EMPTY_STATE);

  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();
  const { openSpaceEditor } = useModals();
  const { leaveSpace } = useSpaceLeaving();
  const { data: spaces } = useSpaces({});

  const { showMutedChannels, toggleShowMutedChannels, isSpaceMuted, toggleSpaceMute } =
    useChannelMute({ spaceId: state.spaceId || '' });

  const openContextMenu = React.useCallback<UseSpaceContextMenuReturn['openContextMenu']>(
    async ({ spaceId, spaceName, iconUrl, event, hasNotifications = false }) => {
      event.preventDefault();
      onOpenChange?.(true);

      let isOwner = false;
      try {
        const ownerKey = await messageDB.getSpaceKey(spaceId, 'owner');
        isOwner = !!ownerKey;
      } catch {
        // Treat as non-owner if the lookup fails
      }

      let hasPublicInvite = false;
      try {
        const space = await messageDB.getSpace(spaceId);
        hasPublicInvite = !!space?.inviteUrl;
      } catch {
        // If the lookup fails, conservatively hide the Invite Members entry
        // for non-owners (owners see it unconditionally).
      }

      setState({
        spaceId,
        spaceName,
        iconUrl,
        isOwner,
        hasPublicInvite,
        position: { x: event.clientX, y: event.clientY },
        hasNotifications,
      });
    },
    [messageDB, onOpenChange]
  );

  const closeContextMenu = React.useCallback(() => {
    setState(EMPTY_STATE);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleMarkSpaceAsRead = React.useCallback(async () => {
    if (!state.spaceId) return;

    const spaceId = state.spaceId;
    const now = Date.now();

    const space = (spaces ?? []).find((s) => s.spaceId === spaceId);
    if (!space) {
      closeContextMenu();
      return;
    }

    const channelIds = space.groups.flatMap((g) => g.channels.map((c) => c.channelId));

    for (const channelId of channelIds) {
      await messageDB.saveReadTime({
        conversationId: `${spaceId}/${channelId}`,
        lastMessageTimestamp: now,
      });
    }

    const threadEntries: Array<{
      threadId: string;
      spaceId: string;
      channelId: string;
      lastReadTimestamp: number;
    }> = [];
    for (const channelId of channelIds) {
      const threads = await messageDB.getChannelThreads({ spaceId, channelId });
      for (const thread of threads) {
        threadEntries.push({
          threadId: thread.threadId,
          spaceId,
          channelId,
          lastReadTimestamp: now,
        });
      }
    }
    if (threadEntries.length > 0) {
      await messageDB.bulkSaveThreadReadTimes(threadEntries);
    }

    queryClient.invalidateQueries({ queryKey: ['mention-counts', 'space'] });
    queryClient.invalidateQueries({ queryKey: ['reply-counts', 'space'] });
    queryClient.invalidateQueries({ queryKey: ['unread-counts', 'space'] });
    queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['unread-counts', 'channel', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['conversation'] });

    closeContextMenu();
  }, [state.spaceId, spaces, messageDB, queryClient, closeContextMenu]);

  const items = React.useMemo<MenuItem[]>(() => {
    if (!state.spaceId) return [];

    const result: MenuItem[] = [
      {
        id: 'account',
        icon: 'user',
        label: t`My Account`,
        onClick: () => openSpaceEditor(state.spaceId!, 'account'),
      },
      {
        id: 'toggle-muted-channels',
        icon: showMutedChannels ? 'eye-off' : 'eye',
        label: showMutedChannels ? t`Hide Muted Channels` : t`Show Muted Channels`,
        onClick: () => toggleShowMutedChannels(),
      },
      {
        id: 'toggle-space-mute',
        icon: isSpaceMuted ? 'bell' : 'bell-off',
        label: isSpaceMuted ? t`Unmute Space` : t`Mute Space`,
        onClick: () => toggleSpaceMute(),
      },
    ];

    if (state.hasNotifications) {
      result.push({
        id: 'mark-all-read',
        icon: 'check',
        label: t`Mark All as Read`,
        onClick: handleMarkSpaceAsRead,
      });
    }

    if (state.isOwner) {
      result.push(
        {
          id: 'settings',
          icon: 'settings',
          label: t`Space Settings`,
          onClick: () => openSpaceEditor(state.spaceId!, 'general'),
          separator: true,
        },
        {
          id: 'invites',
          icon: 'user-plus',
          label: t`Invite Members`,
          onClick: () => openSpaceEditor(state.spaceId!, 'invites'),
        },
        {
          id: 'roles',
          icon: 'shield',
          label: t`Manage Roles`,
          onClick: () => openSpaceEditor(state.spaceId!, 'roles'),
        }
      );
    } else {
      // Non-owners get "Invite Members" only when the owner has published a
      // public invite link. The entry deep-links to the read-only Invites tab.
      if (state.hasPublicInvite) {
        result.push({
          id: 'invites',
          icon: 'user-plus',
          label: t`Invite Members`,
          separator: true,
          onClick: () => openSpaceEditor(state.spaceId!, 'invites'),
        });
      }
      result.push({
        id: 'leave',
        icon: 'logout',
        label: t`Leave Space`,
        danger: true,
        confirmLabel: t`Confirm Leave`,
        separator: !state.hasPublicInvite,
        onClick: () => {
          if (state.spaceId) leaveSpace(state.spaceId);
        },
      });
    }

    return result;
  }, [
    state.spaceId,
    state.isOwner,
    state.hasPublicInvite,
    state.hasNotifications,
    openSpaceEditor,
    leaveSpace,
    showMutedChannels,
    toggleShowMutedChannels,
    isSpaceMuted,
    toggleSpaceMute,
    handleMarkSpaceAsRead,
  ]);

  const contextMenu = state.spaceId ? (
    <ContextMenu
      header={{
        type: 'space',
        spaceId: state.spaceId,
        spaceName: state.spaceName,
        iconUrl: state.iconUrl,
      }}
      items={items}
      position={state.position}
      onClose={closeContextMenu}
    />
  ) : null;

  return { openContextMenu, contextMenu };
}
