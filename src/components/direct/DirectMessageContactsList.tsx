import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import DirectMessageContact from './DirectMessageContact';
import ContextMenu, { MenuItem } from '../ui/ContextMenu';
import { ListSearchInput } from '../ui';
import './DirectMessageContactsList.scss';
import {
  Button,
  Container,
  FlexColumn,
  FlexBetween,
  FlexRow,
  Select,
  Tooltip,
} from '../primitives';
import { useModalContext } from '../context/ModalProvider';
import { useConversationPolling } from '../../hooks';
import { useConversationPreviews } from '../../hooks/business/conversations/useConversationPreviews';
import { useMessageDB } from '../context/useMessageDB';
import { useDMFavorites } from '../../hooks/business/dm/useDMFavorites';

// Safe development-only testing - automatically disabled in production
const ENABLE_MOCK_CONVERSATIONS =
  process.env.NODE_ENV === 'development' &&
  (localStorage?.getItem('debug_mock_conversations') === 'true' ||
    new URLSearchParams(window.location?.search || '').get('users') !== null);
const MOCK_CONVERSATION_COUNT = parseInt(
  new URLSearchParams(window.location?.search || '').get('users') ||
    localStorage?.getItem('debug_mock_conversation_count') ||
    '50'
);

// Filter types
type FilterType = 'all' | 'favorites' | 'requests';

// Helper to check if a conversation is from an "unknown user"
const isUnknownUser = (displayName?: string): boolean => {
  return !displayName || displayName === t`Unknown User`;
};

interface ContextMenuState {
  address: string;
  conversationId: string;
  position: { x: number; y: number };
}

const DirectMessageContactsList: React.FC = () => {
  const { conversations: conversationsList } = useConversationPolling();
  const { data: conversationsWithPreviews = conversationsList } =
    useConversationPreviews(conversationsList);
  const { openNewDirectMessage, openConversationSettings } = useModalContext();
  const [mockUtils, setMockUtils] = React.useState<any>(null);

  // Search and filter state
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [filter, setFilter] = React.useState<FilterType>('all');

  // DM favorites hook
  const { isFavorite, toggleFavorite, favoritesSet } = useDMFavorites();

  // Load mock utilities dynamically in development only
  React.useEffect(() => {
    if (ENABLE_MOCK_CONVERSATIONS) {
      import('../../utils/mock')
        .then((utils) => {
          setMockUtils(utils);
        })
        .catch(() => {
          setMockUtils(null);
        });
    }
  }, []);

  // Memoized mock conversations to prevent regeneration on every render
  const mockConversations = React.useMemo(() => {
    return ENABLE_MOCK_CONVERSATIONS && mockUtils
      ? mockUtils.generateMockConversations(MOCK_CONVERSATION_COUNT)
      : [];
  }, [mockUtils]);

  // Add mock conversations for testing
  const enhancedConversations = React.useMemo(() => {
    if (ENABLE_MOCK_CONVERSATIONS && mockConversations.length > 0) {
      return [...conversationsWithPreviews, ...mockConversations].sort(
        (a, b) => b.timestamp - a.timestamp
      );
    }
    return conversationsWithPreviews;
  }, [conversationsWithPreviews, mockConversations]);

  // Filter and sort conversations
  const filteredConversations = React.useMemo(() => {
    let result = enhancedConversations;

    // Apply filter
    if (filter === 'favorites') {
      result = result.filter((c) => favoritesSet.has(c.conversationId));
    } else if (filter === 'requests') {
      result = result.filter((c) => isUnknownUser(c.displayName));
    }

    // Apply search
    if (searchInput.trim()) {
      const searchLower = searchInput.toLowerCase().trim();
      result = result.filter((c) => {
        const nameMatch = c.displayName?.toLowerCase().includes(searchLower);
        const addressMatch = c.address?.toLowerCase().includes(searchLower);
        return nameMatch || addressMatch;
      });
    }

    // Sort: favorites first (when viewing "all"), then by timestamp
    if (filter === 'all') {
      result = [...result].sort((a, b) => {
        const aFav = favoritesSet.has(a.conversationId) ? 1 : 0;
        const bFav = favoritesSet.has(b.conversationId) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav; // Favorites first
        return b.timestamp - a.timestamp; // Then by timestamp
      });
    }

    return result;
  }, [enhancedConversations, filter, searchInput, favoritesSet]);

  const { deleteConversation } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const navigate = useNavigate();
  const { address: currentAddress } = useParams<{ address: string }>();

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);

  const handleContextMenu = React.useCallback(
    (address: string, conversationId: string) => (e: React.MouseEvent) => {
      setContextMenu({
        address,
        conversationId,
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
      const conversation = enhancedConversations.find(
        (c) => c.address === address
      );
      if (conversation) {
        openConversationSettings(conversation.conversationId);
      }
    },
    [enhancedConversations, openConversationSettings]
  );

  const handleDeleteConversation = React.useCallback(
    async (address: string) => {
      if (!currentPasskeyInfo) return;

      const conversation = enhancedConversations.find(
        (c) => c.address === address
      );
      if (!conversation) return;

      const isActive = currentAddress === address;
      await deleteConversation(conversation.conversationId, currentPasskeyInfo);

      if (isActive) {
        // Navigate to next conversation or empty state
        const remainingConversations = enhancedConversations
          .filter((c) => c.address !== address)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (remainingConversations.length > 0) {
          navigate(`/messages/${remainingConversations[0].address}`);
        } else {
          navigate('/messages');
        }
      }
    },
    [enhancedConversations, currentAddress, currentPasskeyInfo, deleteConversation, navigate]
  );

  // Toggle search row visibility
  const handleToggleSearch = React.useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        // Closing search: reset filter and search input
        setFilter('all');
        setSearchInput('');
      }
      return !prev;
    });
  }, []);

  // Handle filter change
  const handleFilterChange = React.useCallback((value: string | string[]) => {
    setFilter(value as FilterType);
  }, []);

  // Get context menu items for a conversation
  const getContextMenuItems = React.useCallback(
    (address: string, conversationId: string): MenuItem[] => {
      const conversation = enhancedConversations.find(
        (c) => c.address === address
      );
      if (!conversation) return [];

      const favorited = isFavorite(conversationId);

      return [
        {
          id: 'favorite',
          icon: favorited ? 'star-off' : 'star',
          label: favorited ? t`Remove from Favorites` : t`Add to Favorites`,
          onClick: () => {
            toggleFavorite(conversationId);
          },
        },
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
    [enhancedConversations, handleDeleteConversation, openConversationSettings, isFavorite, toggleFavorite]
  );

  // Get the contact data for context menu header
  const contextMenuContact = React.useMemo(() => {
    if (!contextMenu) return null;
    return enhancedConversations.find((c) => c.address === contextMenu.address);
  }, [contextMenu, enhancedConversations]);

  // Filter options for Select
  const filterOptions = React.useMemo(() => [
    { value: 'all', label: t`All` },
    { value: 'favorites', label: t`Favorites` },
    { value: 'requests', label: t`DM Requests` },
  ], []);

  return (
    <Container className="direct-messages-list-wrapper list-bottom-fade flex flex-col h-full z-0 flex-grow select-none">
      <FlexBetween className="direct-messages-header px-4 pt-4 pb-2 lg:py-2 font-semibold flex-shrink-0">
        <Container>
          <Trans>Direct Messages</Trans>
        </Container>
        <FlexRow className="gap-1">
            <Button
              type="unstyled"
              iconName="search"
              iconOnly
              onClick={handleToggleSearch}
              className="header-icon-button mr-1"
            />
          <Tooltip
            id="dm-add-friend"
            content={t`Add a friend`}
            place="bottom"
            showOnTouch={false}
          >
            <Button
              type="primary"
              size="small"
              iconName="user-plus"
              iconSize="lg"
              iconOnly
              onClick={openNewDirectMessage}
            />
          </Tooltip>
        </FlexRow>
      </FlexBetween>

      {/* Search row */}
      {searchOpen && (
        <Container className="px-4 pb-3">
          <FlexRow className="items-center gap-2">
            <Select
              value={filter}
              onChange={handleFilterChange}
              options={filterOptions}
              compactMode={true}
              compactIcon="filter"
              size="small"
            />
            <Container className="flex-1">
              <ListSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder={t`Name or Address`}
                variant="minimal"
                showSearchIcon={false}
              />
            </Container>
          </FlexRow>
          {/* No results message */}
          {filteredConversations.length === 0 && (filter !== 'all' || searchInput) && (
            <Container className="text-xs text-subtle mt-2">
              {filter === 'favorites' ? (
                <Trans>No favorites yet</Trans>
              ) : filter === 'requests' ? (
                <Trans>No message requests</Trans>
              ) : (
                <Trans>No contacts found</Trans>
              )}
            </Container>
          )}
        </Container>
      )}

      <Container className="direct-messages-list list-fade-content flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {conversationsList.length === 0 && !ENABLE_MOCK_CONVERSATIONS ? (
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
            {filteredConversations.map((c) => {
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
                  onContextMenu={handleContextMenu(c.address, c.conversationId)}
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
          items={getContextMenuItems(contextMenu.address, contextMenu.conversationId)}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
        />
      )}
    </Container>
  );
};

export default DirectMessageContactsList;
