import { useState, useEffect, useCallback, useMemo } from 'react';
import debounce from 'lodash/debounce';

interface User {
  address: string;
  displayName?: string;
  userIcon?: string;
}

interface UseMentionInputOptions {
  textValue: string;
  cursorPosition: number;
  users: User[];
  onMentionSelect: (user: User, mentionStart: number, mentionEnd: number) => void;
  debounceMs?: number;
  maxDisplayResults?: number;
  minQueryLength?: number;
}

interface UseMentionInputReturn {
  showDropdown: boolean;
  dropdownPosition: { x: number; y: number };
  filteredUsers: User[];
  selectedIndex: number;
  mentionQuery: string;
  mentionStart: number;
  handleKeyDown: (e: React.KeyboardEvent) => boolean; // returns true if handled
  selectUser: (user: User) => void;
  dismissDropdown: () => void;
}

export function useMentionInput({
  textValue,
  cursorPosition,
  users,
  onMentionSelect,
  debounceMs = 100,
  maxDisplayResults = 50,
  minQueryLength = 2,
}: UseMentionInputOptions): UseMentionInputReturn {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
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

  // Debounced filter function
  const debouncedFilter = useMemo(
    () =>
      debounce((query: string) => {
        const filtered = filterUsers(query);
        setFilteredUsers(filtered);
        setSelectedIndex(0);
      }, debounceMs),
    [filterUsers, debounceMs]
  );

  // Detect @ mentions and extract query
  useEffect(() => {
    // Find the @ before the cursor
    let atPosition = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      const char = textValue[i];
      if (char === '@') {
        atPosition = i;
        break;
      }
      // Stop if we hit a space or newline (mention ended)
      if (char === ' ' || char === '\n') {
        break;
      }
    }

    if (atPosition !== -1) {
      // Check if this is a raw address mention (starts with @<)
      if (textValue[atPosition + 1] === '<') {
        // Don't show dropdown for manual address entry
        setShowDropdown(false);
        setMentionQuery('');
        setMentionStart(-1);
        return;
      }

      // Extract the query after @
      const query = textValue.substring(atPosition + 1, cursorPosition);

      // Only show dropdown if we have a query or just typed @
      if (query.length === 0 || !query.includes(' ')) {
        setMentionQuery(query);
        setMentionStart(atPosition);
        setShowDropdown(true);
        debouncedFilter(query);
      } else {
        // Query contains space, not a mention anymore
        setShowDropdown(false);
        setMentionQuery('');
        setMentionStart(-1);
      }
    } else {
      // No @ found
      setShowDropdown(false);
      setMentionQuery('');
      setMentionStart(-1);
    }
  }, [textValue, cursorPosition, debouncedFilter]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!showDropdown || filteredUsers.length === 0) {
        return false;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          return true;

        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            selectUser(filteredUsers[selectedIndex]);
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
    [showDropdown, filteredUsers, selectedIndex]
  );

  // Select a user from the dropdown
  const selectUser = useCallback(
    (user: User) => {
      if (mentionStart !== -1) {
        const mentionEnd = mentionStart + mentionQuery.length + 1; // +1 for @
        onMentionSelect(user, mentionStart, mentionEnd);
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
    setFilteredUsers([]);
  }, []);

  return {
    showDropdown: showDropdown && filteredUsers.length > 0,
    dropdownPosition,
    filteredUsers,
    selectedIndex,
    mentionQuery,
    mentionStart,
    handleKeyDown,
    selectUser,
    dismissDropdown,
  };
}