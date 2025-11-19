import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Channel, Group } from '../../../api/quorumApi';

interface User {
  address: string;
  displayName?: string;
  userIcon?: string;
}

interface Role {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
}

// Discriminated union for display
export type MentionOption =
  | { type: 'user'; data: User }
  | { type: 'role'; data: Role }
  | { type: 'channel'; data: Channel }
  | { type: 'everyone' }
  | { type: 'group-header'; data: { groupName: string; icon?: string; iconColor?: string } };

interface UseMentionInputOptions {
  textValue: string;
  cursorPosition: number;
  users: User[];
  roles?: Role[]; // NEW - optional roles for autocomplete
  groups?: Group[]; // NEW - channel groups for autocomplete (replaces flat channels)
  canUseEveryone?: boolean; // NEW - permission to use @everyone
  onMentionSelect: (option: MentionOption, mentionStart: number, mentionEnd: number) => void;
  debounceMs?: number;
  maxDisplayResults?: number;
  minQueryLength?: number;
}

interface UseMentionInputReturn {
  showDropdown: boolean;
  dropdownPosition: { x: number; y: number };
  filteredOptions: MentionOption[]; // Changed from filteredUsers
  selectedIndex: number;
  mentionQuery: string;
  mentionStart: number;
  handleKeyDown: (e: React.KeyboardEvent) => boolean; // returns true if handled
  selectOption: (option: MentionOption) => void; // Changed from selectUser
  dismissDropdown: () => void;
}

export function useMentionInput({
  textValue,
  cursorPosition,
  users,
  roles,
  groups,
  canUseEveryone = false,
  onMentionSelect,
  debounceMs = 100,
  maxDisplayResults = 50,
  minQueryLength = 3,
}: UseMentionInputOptions): UseMentionInputReturn {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredOptions, setFilteredOptions] = useState<MentionOption[]>([]);
  const [dropdownPosition] = useState({ x: 0, y: 0 }); // Will be positioned by CSS relative to textarea

  // Filter and rank users based on query
  const filterUsers = useCallback(
    (query: string): User[] => {
      // Require minimum query length to avoid showing too many results
      if (!query || query.length < minQueryLength) return [];

      const queryLower = query.toLowerCase();

      // Filter users whose displayName or address matches the query
      const matches = users.filter(user => {
        const name = user.displayName?.toLowerCase() || '';
        const addr = user.address.toLowerCase();
        return name.includes(queryLower) || addr.includes(queryLower);
      });

      // Sort by relevance: exact match > starts with > contains
      const sortedMatches = matches.sort((a, b) => {
        const aName = a.displayName?.toLowerCase() || '';
        const bName = b.displayName?.toLowerCase() || '';

        // Exact match gets highest priority
        if (aName === queryLower && bName !== queryLower) return -1;
        if (bName === queryLower && aName !== queryLower) return 1;

        // Starts with gets second priority
        if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
        if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;

        // Then alphabetical order
        return aName.localeCompare(bName);
      });

      // Limit results for performance
      return sortedMatches.slice(0, maxDisplayResults);
    },
    [users, minQueryLength, maxDisplayResults]
  );

  // NEW: Filter and rank roles based on query
  const filterRoles = useCallback(
    (query: string): Role[] => {
      if (!query || query.length < minQueryLength || !roles) return [];

      const queryLower = query.toLowerCase();

      // Filter roles whose displayName or roleTag matches the query
      const matches = roles.filter(role => {
        const name = role.displayName.toLowerCase();
        const tag = role.roleTag.toLowerCase();
        return name.includes(queryLower) || tag.includes(queryLower);
      });

      // Sort by relevance: exact match > starts with > contains
      const sortedMatches = matches.sort((a, b) => {
        const aName = a.displayName.toLowerCase();
        const bName = b.displayName.toLowerCase();

        // Exact match gets highest priority
        if (aName === queryLower && bName !== queryLower) return -1;
        if (bName === queryLower && aName !== queryLower) return 1;

        // Starts with gets second priority
        if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
        if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;

        // Then alphabetical order
        return aName.localeCompare(bName);
      });

      return sortedMatches.slice(0, maxDisplayResults);
    },
    [roles, minQueryLength, maxDisplayResults]
  );

  // NEW: Filter channels by groups based on query
  const filterChannelGroups = useCallback(
    (query: string): MentionOption[] => {
      if (!groups) return [];

      const queryLower = query.toLowerCase();
      const result: MentionOption[] = [];
      let totalChannels = 0;

      // Process each group
      for (const group of groups) {
        // Filter channels in this group that match the query
        const matchingChannels = group.channels.filter(channel => {
          if (!query) return true; // Show all channels when no query
          const name = channel.channelName.toLowerCase();
          return name.includes(queryLower);
        });

        if (matchingChannels.length > 0) {
          // Sort channels within the group by relevance
          const sortedChannels = matchingChannels.sort((a, b) => {
            if (!query) {
              // No query: sort by pinned first, then creation date
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              if (a.isPinned && b.isPinned) {
                return (b.pinnedAt || 0) - (a.pinnedAt || 0);
              }
              return (a.createdDate || 0) - (b.createdDate || 0);
            } else {
              // With query: sort by relevance
              const aName = a.channelName.toLowerCase();
              const bName = b.channelName.toLowerCase();

              if (aName === queryLower && bName !== queryLower) return -1;
              if (bName === queryLower && aName !== queryLower) return 1;
              if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
              if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;

              return aName.localeCompare(bName);
            }
          });

          // Add group header
          result.push({
            type: 'group-header',
            data: {
              groupName: group.groupName,
              icon: group.icon,
              iconColor: group.iconColor,
            },
          });

          // Add channels from this group
          for (const channel of sortedChannels) {
            if (totalChannels >= 25) break; // Limit total channels
            result.push({
              type: 'channel',
              data: channel,
            });
            totalChannels++;
          }
        }

        if (totalChannels >= 25) break; // Stop if we've reached the limit
      }

      return result;
    },
    [groups]
  );

  // Check if @everyone matches the query
  const checkEveryoneMatch = useCallback(
    (query: string): boolean => {
      if (!canUseEveryone) return false;

      // @everyone should show up for empty query or any partial match
      if (!query || query.length === 0) return true;

      const queryLower = query.toLowerCase();
      return 'everyone'.startsWith(queryLower);
    },
    [canUseEveryone]
  );

  // Filter function - combines users, roles, channels, and @everyone
  const filterMentions = useCallback((query: string, mentionType: '@' | '#' = '@') => {
    let options: MentionOption[];

    if (mentionType === '#') {
      // Channel mentions: show grouped channels
      options = filterChannelGroups(query);
      setFilteredOptions(options);
    } else {
      // User/role mentions: show users, roles, and @everyone
      const filteredUsers = filterUsers(query);
      const filteredRoles = filterRoles(query);
      const everyoneMatches = checkEveryoneMatch(query);

      options = [
        // Put @everyone first if it matches (most prominent)
        ...(everyoneMatches ? [{ type: 'everyone' as const }] : []),
        ...filteredUsers.map(u => ({ type: 'user' as const, data: u })),
        ...filteredRoles.map(r => ({ type: 'role' as const, data: r })),
      ];
      setFilteredOptions(options);
    }

    // Find first selectable index (skip group headers)
    const firstSelectableIndex = options.findIndex(option => option.type !== 'group-header');
    setSelectedIndex(Math.max(0, firstSelectableIndex));
  }, [filterUsers, filterRoles, filterChannelGroups, checkEveryoneMatch]);

  // Detect @ and # mentions and extract query
  useEffect(() => {
    // Find the @ or # before the cursor
    let mentionPosition = -1;
    let mentionChar = '';
    for (let i = cursorPosition - 1; i >= 0; i--) {
      const char = textValue[i];
      if (char === '@' || char === '#') {
        mentionPosition = i;
        mentionChar = char;
        break;
      }
      // Stop if we hit a space or newline (mention ended)
      if (char === ' ' || char === '\n') {
        break;
      }
    }

    if (mentionPosition !== -1) {
      // Check if this is a raw address mention (starts with @<)
      if (mentionChar === '@' && textValue[mentionPosition + 1] === '<') {
        // Don't show dropdown for manual address entry
        setShowDropdown(false);
        setMentionQuery('');
        setMentionStart(-1);
        return;
      }

      // Extract the query after @ or #
      const query = textValue.substring(mentionPosition + 1, cursorPosition);

      // Only show dropdown if we have a query or just typed @ or #
      if (query.length === 0 || !query.includes(' ')) {
        setMentionQuery(query);
        setMentionStart(mentionPosition);
        setShowDropdown(true);

        // Debounced filtering using setTimeout
        const timer = setTimeout(() => {
          filterMentions(query, mentionChar as '@' | '#');
        }, debounceMs);

        return () => clearTimeout(timer);
      } else {
        // Query contains space, not a mention anymore
        setShowDropdown(false);
        setMentionQuery('');
        setMentionStart(-1);
      }
    } else {
      // No @ or # found
      setShowDropdown(false);
      setMentionQuery('');
      setMentionStart(-1);
    }
  }, [textValue, cursorPosition, filterMentions, debounceMs]);

  // Handle keyboard navigation (skip group headers)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!showDropdown || filteredOptions.length === 0) {
        return false;
      }

      // Helper function to find next selectable index
      const findNextSelectableIndex = (currentIndex: number, direction: 'up' | 'down'): number => {
        let nextIndex = currentIndex;
        const step = direction === 'down' ? 1 : -1;

        do {
          nextIndex += step;
          if (nextIndex >= filteredOptions.length) nextIndex = 0;
          if (nextIndex < 0) nextIndex = filteredOptions.length - 1;
        } while (
          filteredOptions[nextIndex]?.type === 'group-header' &&
          nextIndex !== currentIndex
        );

        return nextIndex;
      };

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => findNextSelectableIndex(prev, 'down'));
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => findNextSelectableIndex(prev, 'up'));
          return true;

        case 'Enter':
        case 'Tab':
          e.preventDefault();
          const selectedOption = filteredOptions[selectedIndex];
          if (selectedOption && selectedOption.type !== 'group-header') {
            selectOption(selectedOption);
          }
          return true;

        case 'Escape':
          e.preventDefault();
          dismissDropdown();
          return true;

        default:
          return false;
      }
    },
    [showDropdown, filteredOptions, selectedIndex]
  );

  // Select an option (user, role, or channel) from the dropdown
  const selectOption = useCallback(
    (option: MentionOption) => {
      // Only allow selection of actionable items (not group headers)
      if (option.type === 'group-header') return;

      if (mentionStart !== -1) {
        const mentionEnd = mentionStart + mentionQuery.length + 1; // +1 for @ or #
        onMentionSelect(option, mentionStart, mentionEnd);
        dismissDropdown();
      }
    },
    [mentionStart, mentionQuery, onMentionSelect]
  );

  // Dismiss the dropdown
  const dismissDropdown = useCallback(() => {
    setShowDropdown(false);
    setMentionQuery('');
    setMentionStart(-1);
    setSelectedIndex(0);
    setFilteredOptions([]);
  }, []);

  return {
    showDropdown: showDropdown && filteredOptions.length > 0,
    dropdownPosition,
    filteredOptions,
    selectedIndex,
    mentionQuery,
    mentionStart,
    handleKeyDown,
    selectOption,
    dismissDropdown,
  };
}