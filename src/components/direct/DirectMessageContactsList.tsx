import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import DirectMessageContact from './DirectMessageContact';
import ContextMenu, { MenuItem } from '../ui/ContextMenu';
import './DirectMessageContactsList.scss';
import {
  Button,
  Container,
  FlexColumn,
  FlexBetween,
} from '../primitives';
import { useModalContext } from '../context/ModalProvider';
import { useConversationPolling } from '../../hooks';
import { useConversationPreviews } from '../../hooks/business/conversations/useConversationPreviews';
import { useMessageDB } from '../context/useMessageDB';

interface ContextMenuState {
  address: string;
  position: { x: number; y: number };
}

const DirectMessageContactsList: React.FC<{}> = ({}) => {
  const { conversations: conversationsList } = useConversationPolling();
  const { data: conversationsWithPreviews = conversationsList } =
    useConversationPreviews(conversationsList);
  const { openNewDirectMessage, openConversationSettings } = useModalContext();
  const { deleteConversation } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const navigate = useNavigate();
  const { address: currentAddress } = useParams<{ address: string }>();

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);

  const handleContextMenu = React.useCallback(
    (address: string) => (e: React.MouseEvent) => {
      setContextMenu({
        address,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    []
  );

  const handleCloseContextMenu = React.useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleOpenSettings = React.useCallback(
    (address: string) => () => {
      // Find the conversation to get the conversationId
      const conversation = conversationsWithPreviews.find(
        (c) => c.address === address
      );
      if (conversation) {
        openConversationSettings(conversation.conversationId);
      }
    },
    [conversationsWithPreviews, openConversationSettings]
  );

  const handleDeleteConversation = React.useCallback(
    async (address: string) => {
      if (!currentPasskeyInfo) return;

      const conversation = conversationsWithPreviews.find(
        (c) => c.address === address
      );
      if (!conversation) return;

      const isActive = currentAddress === address;
      await deleteConversation(conversation.conversationId, currentPasskeyInfo);

      if (isActive) {
        // Navigate to next conversation or empty state
        const remainingConversations = conversationsWithPreviews
          .filter((c) => c.address !== address)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (remainingConversations.length > 0) {
          navigate(`/messages/${remainingConversations[0].address}`);
        } else {
          navigate('/messages');
        }
      }
    },
    [conversationsWithPreviews, currentAddress, currentPasskeyInfo, deleteConversation, navigate]
  );

  // Get context menu items for a conversation
  const getContextMenuItems = React.useCallback(
    (address: string): MenuItem[] => {
      const conversation = conversationsWithPreviews.find(
        (c) => c.address === address
      );
      if (!conversation) return [];

      return [
        {
          id: 'settings',
          icon: 'settings',
          label: t`Conversation Settings`,
          onClick: () => {
            openConversationSettings(conversation.conversationId);
          },
        },
        {
          id: 'delete',
          icon: 'trash',
          label: t`Delete Conversation`,
          confirmLabel: t`Confirm Delete`,
          danger: true,
          onClick: () => handleDeleteConversation(address),
        },
      ];
    },
    [conversationsWithPreviews, handleDeleteConversation, openConversationSettings]
  );

  // Get the contact data for context menu header
  const contextMenuContact = React.useMemo(() => {
    if (!contextMenu) return null;
    return conversationsWithPreviews.find((c) => c.address === contextMenu.address);
  }, [contextMenu, conversationsWithPreviews]);

  return (
    <Container className="direct-messages-list-wrapper list-bottom-fade flex flex-col h-full z-0 flex-grow select-none">
      <FlexBetween className="direct-messages-header px-4 pt-4 pb-2 lg:py-2 font-semibold flex-shrink-0">
        <Container>
          <Trans>Direct Messages</Trans>
        </Container>
        <FlexColumn className="justify-around">
          <Button
            type="primary"
            size="small"
            iconName="user-plus"
            iconSize="lg"
            iconOnly
            onClick={openNewDirectMessage}
            tooltip="Add a friend"
          />
        </FlexColumn>
      </FlexBetween>
      <Container className="direct-messages-list list-fade-content flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {conversationsList.length === 0 ? (
          <FlexColumn className="justify-center items-center flex-1 px-4">
            <Container className="w-full text-center mb-4 text-subtle">
              <Trans>Ready to start a truly private conversation?</Trans>
            </Container>
            <Button
              type="primary"
              className="max-w-full"
              onClick={openNewDirectMessage}
            >
              <Trans>+ Add a friend</Trans>
            </Button>
          </FlexColumn>
        ) : (
          <>
            {conversationsWithPreviews.map((c) => {
              return (
                <DirectMessageContact
                  unread={(c.lastReadTimestamp ?? 0) < c.timestamp}
                  key={'dmc-' + c.address}
                  address={c.address}
                  userIcon={c.icon}
                  displayName={c.displayName}
                  lastMessagePreview={c.preview}
                  previewIcon={c.previewIcon}
                  timestamp={c.timestamp}
                  onContextMenu={handleContextMenu(c.address)}
                  onOpenSettings={handleOpenSettings(c.address)}
                />
              );
            })}
          </>
        )}
      </Container>

      {/* Context menu */}
      {contextMenu && contextMenuContact && (
        <ContextMenu
          header={{
            type: 'user',
            address: contextMenu.address,
            displayName: contextMenuContact.displayName,
            userIcon: contextMenuContact.icon,
          }}
          items={getContextMenuItems(contextMenu.address)}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
        />
      )}
    </Container>
  );
};

export default DirectMessageContactsList;
