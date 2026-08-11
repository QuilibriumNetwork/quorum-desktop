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
  Flex,
  Select,
  Tooltip,
} from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { realIconOrUndefined, realDisplayNameOrUndefined } from '../../utils/identityPlaceholder';
import { useModalContext } from '../context/ModalProvider';
import { useConversationPolling } from '../../hooks';
import {
  useConversationPreviews,
  withPreviews,
} from '../../hooks/business/conversations/useConversationPreviews';
import { useConversationsWithProfileBackfill } from '../../hooks/business/conversations/useConversationsWithProfileBackfill';
import { useMessageDB } from '../context/useMessageDB';
import { useDMFavorites } from '../../hooks/business/dm/useDMFavorites';
import { useDMMute } from '../../hooks/business/dm/useDMMute';
import { useOptionalShellState } from '../shell/useShellState';
import {
  IdentityScopeProvider,
  useNameResolver,
  useResolvedMemberName,
} from '../../identity';

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
type FilterType = 'all' | 'favorites' | 'unknown' | 'muted';

// Helper to check if a conversation is from an "unknown user"
const isUnknownUser = (displayName?: string): boolean => {
  return !displayName || displayName === t`Unknown User`;
};

interface ContextMenuState {
  address: string;
  conversationId: string;
  position: { x: number; y: number };
}

interface DirectMessageContactsListProps {
  /** When true, force the expanded list view regardless of the global
   *  collapse preference. Used when rendered inside the phone drawer. */
  forceExpanded?: boolean;
}

/**
 * The collapsed sidebar's one-row-per-contact strip. A `.map()` body cannot
 * call a hook per iteration (Rules of Hooks), so this is its own component —
 * mirrors `<DirectMessageContact>`, the expanded row, which resolves the
 * same way. `enrich`: same bounded, one-person-per-row surface.
 */
const DirectMessageStripRow: React.FC<{
  address: string;
  icon?: string;
  isActive: boolean;
  unread: boolean;
  onNavigate: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ address, icon, isActive, unread, onNavigate, onContextMenu }) => {
  // Computed ONCE and reused for the tooltip, the aria-label and the
  // avatar's bare name, so none of them can disagree.
  const resolved = useResolvedMemberName(address, { enrich: true });
  const name = resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name;

  return (
    <Tooltip
      id={`dm-strip-${address}`}
      content={name}
      place="right"
      showOnTouch={false}
    >
      <button
        type="button"
        className={`direct-messages-strip-row sidebar-row-chrome ${isActive ? 'direct-messages-strip-row--active' : ''}`}
        onClick={onNavigate}
        onContextMenu={onContextMenu}
        aria-label={name}
        aria-current={isActive ? 'page' : undefined}
      >
        <div className="direct-messages-strip-avatar">
          <UserAvatar
            // Same resolved identity as the tooltip/aria-label above — a
            // placeholder must never reach here.
            displayName={resolved.name}
            userIcon={realIconOrUndefined(icon)}
            address={address}
            size={44}
          />
          {unread && <span className="icon-unread-dot" />}
        </div>
      </button>
    </Tooltip>
  );
};

/**
 * DM contacts are a DETACHED surface mounted from `Sidebar.tsx` (the app
 * shell) — there is no ambient `<IdentityScopeProvider>` above it, unlike
 * `Channel.tsx`'s space subtree. This thin shell mounts one (global scope:
 * DM conversations carry no spaceId, so a per-space nickname is meaningless
 * here) and renders the real body as its child, so the child's hook calls
 * (`useNameResolver`, and `<DirectMessageContact>`'s own
 * `useResolvedMemberName`) resolve against real context instead of running
 * before the provider — which THIS component itself creates — exists in the
 * tree. Same shape as `DirectMessage.tsx`'s own provider and `ThreadPanel`'s
 * `ThreadTypingIndicator`.
 */
const DirectMessageContactsList: React.FC<DirectMessageContactsListProps> = (props) => {
  const { currentPasskeyInfo } = usePasskeysContext();
  // Fetched here (not in Inner) so it can ALSO feed the provider's
  // `locallyKnownNames` map — the outer shell is the one component that
  // exists both outside the provider (as its creator) and needs this data,
  // so lifting the fetch is cheaper than fetching it twice.
  const { conversations: conversationsList } = useConversationPolling();

  // Fed to the provider's `locallyKnownNames` tier (fix round 1, design
  // constraint 5): a DM partner's LOCAL `Conversation.displayName` — learned
  // from a peer broadcast or a decrypted message frame, no network
  // round-trip — is the last resort before a truncated address, for a
  // partner who has never published a public profile. Built from ALL
  // conversations (not just currently-filtered/rendered ones), same
  // reasoning as `Inner`'s proactive `requestNames` below: a row must be
  // resolvable the moment it's needed, not only once it happens to render.
  const localNamesByAddress = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of conversationsList) {
      const name = realDisplayNameOrUndefined(c.displayName);
      if (name && c.address) map[c.address] = name;
    }
    return map;
  }, [conversationsList]);

  return (
    <IdentityScopeProvider
      rostersBySpace={{}}
      selfAddress={currentPasskeyInfo?.address || null}
      locallyKnownNames={localNamesByAddress}
    >
      <DirectMessageContactsListInner {...props} conversationsList={conversationsList} />
    </IdentityScopeProvider>
  );
};

const DirectMessageContactsListInner: React.FC<
  DirectMessageContactsListProps & {
    conversationsList: ReturnType<typeof useConversationPolling>['conversations'];
  }
> = ({ forceExpanded, conversationsList }) => {
  // Back-fill displayName / icon from the public profile for contacts whose
  // local row still holds the "Unknown User" / default-avatar placeholder,
  // and write the result through to IndexedDB so later loads are instant.
  // Name RESOLUTION (the .q suffix, search matching) no longer reads the
  // `primaryUsername` this attaches — that now comes from the identity
  // module's own `enrich` request below, which shares the same
  // `publicProfileQueryKey(address)` cache entry, so this doesn't add a
  // second network round-trip per partner.
  const conversationsBackfilled =
    useConversationsWithProfileBackfill(conversationsList);
  // Previews are cached by lastMessageId; everything else on the row (read
  // state, timestamp, identity) comes from the live polled data. Merging here
  // rather than caching whole rows is what keeps the unread dot honest — see
  // the note on useConversationPreviews.
  const { data: previewsByConversationId } =
    useConversationPreviews(conversationsBackfilled);
  const conversationsWithPreviews = React.useMemo(
    () => withPreviews(conversationsBackfilled, previewsByConversationId),
    [conversationsBackfilled, previewsByConversationId]
  );
  const { openNewDirectMessage, openConversationSettings } = useModalContext();
  const [mockUtils, setMockUtils] = React.useState<any>(null);

  // Search and filter state
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [filter, setFilter] = React.useState<FilterType>('all');

  // DM favorites hook
  const { isFavorite, toggleFavorite, favoritesSet } = useDMFavorites();

  // DM mute hook
  const { isMuted, toggleMute, mutedSet } = useDMMute();

  // Shell state — null when rendered outside the AppShell tree (legacy fallback).
  // sidebarLiveCollapsed follows the on-screen width during drag so the layout
  // re-renders as the user crosses the snap threshold.
  const shell = useOptionalShellState();
  const sidebarCollapsed = shell?.sidebarLiveCollapsed ?? false;
  const renderCollapsed = sidebarCollapsed && !forceExpanded;

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

  // Imperative/bulk resolution — search matching runs inside a `useMemo`
  // over every conversation, not inside JSX, so it cannot call a hook per
  // row (see `useNameResolver`'s docstring). `resolve()` is a pure read of
  // whatever the provider already has; `requestNames()` below is what
  // actually asks for a profile fetch.
  const { resolve, requestNames } = useNameResolver();

  // Request every distinct partner's profile up front, not just the ones
  // currently rendered — a conversation hidden by an active filter/search
  // still needs its profile in hand so a NEW search term can match its QNS
  // name on the first keystroke, not only after it happens to render once.
  // `requestNames` dedupes internally, and shares the same
  // `publicProfileQueryKey(address)` cache entry `<DirectMessageContact>`'s
  // own `enrich` requests below use — no second fetch path.
  const distinctAddresses = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of enhancedConversations) {
      if (c.address && !seen.has(c.address)) {
        seen.add(c.address);
        out.push(c.address);
      }
    }
    return out;
  }, [enhancedConversations]);
  React.useEffect(() => {
    requestNames(distinctAddresses);
  }, [distinctAddresses, requestNames]);

  // Filter and sort conversations
  const filteredConversations = React.useMemo(() => {
    let result = enhancedConversations;

    // Apply filter
    if (filter === 'favorites') {
      result = result.filter((c) => favoritesSet.has(c.conversationId));
    } else if (filter === 'unknown') {
      result = result.filter((c) => isUnknownUser(c.displayName));
    } else if (filter === 'muted') {
      result = result.filter((c) => mutedSet.has(c.conversationId));
    }

    // Apply search — must match the RESOLVED name, because that is what the
    // row renders. Ports `conversationSearch.ts`'s exact matching rule
    // (resolved name OR raw stored displayName OR address — a strict
    // superset, see that file's history) onto `resolve()` from the identity
    // module instead of the deleted `resolveMemberName`.
    if (searchInput.trim()) {
      const needle = searchInput.trim().toLowerCase();
      result = result.filter((c) => {
        const resolved = resolve(c.address);
        const resolvedName = resolved.isQnsVerified
          ? `${resolved.name}.q`
          : resolved.name;
        return (
          resolvedName.toLowerCase().includes(needle) ||
          !!c.displayName?.toLowerCase().includes(needle) ||
          !!c.address?.toLowerCase().includes(needle)
        );
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
  }, [enhancedConversations, filter, searchInput, favoritesSet, mutedSet, resolve]);

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
      const muted = isMuted(conversationId);

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
          id: 'mute',
          icon: muted ? 'bell' : 'bell-off',
          label: muted ? t`Unmute Conversation` : t`Mute Conversation`,
          onClick: () => {
            toggleMute(conversationId);
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
    [enhancedConversations, handleDeleteConversation, openConversationSettings, isFavorite, toggleFavorite, isMuted, toggleMute]
  );

  // Get the contact data for context menu header
  const contextMenuContact = React.useMemo(() => {
    if (!contextMenu) return null;
    return enhancedConversations.find((c) => c.address === contextMenu.address);
  }, [contextMenu, enhancedConversations]);

  // The right-click menu's header name — resolved via `src/identity`, never
  // `contextMenuContact.displayName` raw. That field is `Conversation.
  // displayName`, which can literally hold the placeholder string
  // "Unknown User" (see `isUnknownUser` above) and is stale-capable (learned
  // once from a peer broadcast, never re-derived). `resolve()` reads the SAME
  // ladder `<DirectMessageContact>`'s own row uses, already enriched by the
  // proactive `requestNames(distinctAddresses)` above, so the menu header
  // never disagrees with the row it was opened from.
  const contextMenuHeaderName = React.useMemo(() => {
    if (!contextMenu) return undefined;
    const r = resolve(contextMenu.address);
    return r.isQnsVerified ? `${r.name}.q` : r.name;
  }, [contextMenu, resolve]);

  // Calculate filter availability based on data
  const hasFavorites = React.useMemo(
    () => enhancedConversations.some((c) => favoritesSet.has(c.conversationId)),
    [enhancedConversations, favoritesSet]
  );
  const hasUnknown = React.useMemo(
    () => enhancedConversations.some((c) => isUnknownUser(c.displayName)),
    [enhancedConversations]
  );
  const hasMuted = React.useMemo(
    () => enhancedConversations.some((c) => mutedSet.has(c.conversationId)),
    [enhancedConversations, mutedSet]
  );
  const hasAnyFilter = hasFavorites || hasUnknown || hasMuted;

  // Filter options for Select - dynamically show only available filters
  const filterOptions = React.useMemo(() => {
    const options: { value: string; label: string; icon?: string }[] = [
      { value: 'all', label: t`All`, icon: 'users' },
    ];
    if (hasFavorites) options.push({ value: 'favorites', label: t`Favorites`, icon: 'star' });
    if (hasUnknown) options.push({ value: 'unknown', label: t`Unknown`, icon: 'question-mark' });
    if (hasMuted) options.push({ value: 'muted', label: t`Muted`, icon: 'bell-off' });
    return options;
  }, [hasFavorites, hasUnknown, hasMuted]);

  // Reset filter if active option becomes unavailable
  React.useEffect(() => {
    if (filter === 'muted' && !hasMuted) {
      setFilter('all');
    } else if (filter === 'favorites' && !hasFavorites) {
      setFilter('all');
    } else if (filter === 'unknown' && !hasUnknown) {
      setFilter('all');
    }
  }, [filter, hasMuted, hasFavorites, hasUnknown]);

  if (renderCollapsed && shell) {
    return (
      <div className="direct-messages-list-wrapper direct-messages-list-wrapper--collapsed flex flex-col h-full z-0 flex-grow select-none">
        <div className="direct-messages-list-strip flex flex-col overflow-y-auto overflow-x-hidden">
          {filteredConversations.map((c) => {
            const isActive = currentAddress === c.address;
            const unread =
              (c.lastReadTimestamp ?? 0) < c.timestamp &&
              !mutedSet.has(c.conversationId);
            return (
              <DirectMessageStripRow
                key={'dmc-strip-' + c.address}
                address={c.address}
                icon={c.icon}
                isActive={isActive}
                unread={unread}
                onNavigate={() => navigate(`/messages/${c.address}`)}
                onContextMenu={handleContextMenu(c.address, c.conversationId)}
              />
            );
          })}
        </div>
        {contextMenu && contextMenuContact && (
          <ContextMenu
            header={{
              type: 'user',
              address: contextMenu.address,
              displayName: contextMenuHeaderName ?? '',
              userIcon: contextMenuContact.icon,
            }}
            items={getContextMenuItems(contextMenu.address, contextMenu.conversationId)}
            position={contextMenu.position}
            onClose={handleCloseContextMenu}
          />
        )}
      </div>
    );
  }

  return (
    <div className="direct-messages-list-wrapper list-bottom-fade flex flex-col h-full z-0 flex-grow select-none">
      <div className="sidebar-header">
        <span className="sidebar-header__title">{t`Messages`}</span>
        <Button
          type="unstyled"
          iconName="search"
          iconSize="lg"
          iconOnly
          onClick={handleToggleSearch}
          className={`header-icon-button ${searchOpen ? 'active--accent' : ''}`}
          ariaLabel={t`Search direct messages`}
        />
        <Tooltip
          id="dm-add-friend"
          content={t`Add a friend`}
          place="bottom"
          showOnTouch={false}
        >
          <Button
            type="secondary"
            iconName="user-plus"
            iconSize="lg"
            iconOnly
            onClick={openNewDirectMessage}
            className="sidebar-header-action"
            ariaLabel={t`Add a friend`}
          />
        </Tooltip>
      </div>

      {/* Search row */}
      {searchOpen && (
        <div className="px-3.5 pt-2 pb-3">
          <Flex className="sidebar-search-row items-center">
            {hasAnyFilter && (
              <Select
                value={filter}
                onChange={handleFilterChange}
                options={filterOptions}
                compactMode={true}
                compactIcon="filter"
                size="small"
                borderedDropdown
              />
            )}
            <div className="flex-1">
              <ListSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder={t`Name or Address`}
                variant="minimal"
                showSearchIcon={false}
              />
            </div>
          </Flex>
          {/* No results message */}
          {filteredConversations.length === 0 && (filter !== 'all' || searchInput) && (
            <div className="text-xs text-subtle mt-2">
              {filter === 'favorites' ? (
                <Trans>No favorites yet</Trans>
              ) : filter === 'unknown' ? (
                <Trans>No unknown contacts</Trans>
              ) : filter === 'muted' ? (
                <Trans>No muted conversations</Trans>
              ) : (
                <Trans>No contacts found</Trans>
              )}
            </div>
          )}
        </div>
      )}

      <div className="direct-messages-list list-fade-content flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {conversationsList.length === 0 && !ENABLE_MOCK_CONVERSATIONS ? (
          <Flex direction="column" className="justify-center items-center flex-1 px-4">
            <div className="w-full text-center mb-4 text-subtle">
              <Trans>Ready to start a truly private conversation?</Trans>
            </div>
            <Button
              type="primary"
              className="max-w-full"
              onClick={openNewDirectMessage}
            >
              <Trans>+ Add a friend</Trans>
            </Button>
          </Flex>
        ) : (
          <>
            {filteredConversations.map((c) => {
              return (
                <DirectMessageContact
                  unread={
                    (c.lastReadTimestamp ?? 0) < c.timestamp &&
                    !mutedSet.has(c.conversationId)
                  }
                  key={'dmc-' + c.address}
                  address={c.address}
                  userIcon={c.icon}
                  displayName={c.displayName}
                  lastMessagePreview={c.preview}
                  previewIcon={c.previewIcon}
                  timestamp={c.timestamp}
                  isMuted={mutedSet.has(c.conversationId)}
                  isFavorite={favoritesSet.has(c.conversationId)}
                  onContextMenu={handleContextMenu(c.address, c.conversationId)}
                  onOpenSettings={handleOpenSettings(c.address)}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && contextMenuContact && (
        <ContextMenu
          header={{
            type: 'user',
            address: contextMenu.address,
            displayName: contextMenuHeaderName ?? '',
            userIcon: contextMenuContact.icon,
          }}
          items={getContextMenuItems(contextMenu.address, contextMenu.conversationId)}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
        />
      )}
    </div>
  );
};

export default DirectMessageContactsList;
