# Complete Guide: Cross-Platform React Components for Web + Native

**Auto-reviewed and corrected against .agents/docs/component-management-guide.md - still needs human review : _Last review: 2025-08-14 10:45 UTC_**

This guide provides architectural patterns and practical examples specific to this Quilibrium desktop/mobile app. All examples use our actual primitives, utilities, and file structure.

## Table of Contents

1. [Introduction](#introduction)
2. [Architectural Foundations](#architectural-foundations)
3. [Decision Framework: One vs Two Components](#decision-framework-one-vs-two-components)
4. [Logic Classification & Extraction](#logic-classification--extraction)
5. [Implementation Patterns](#implementation-patterns)
6. [Best Practices](#best-practices)
7. [Testing Strategies](#testing-strategies)
8. [Common Patterns & Examples](#common-patterns--examples)
9. [Performance Considerations](#performance-considerations)
10. [Migration Strategies](#migration-strategies)

---

## Introduction

Building cross-platform React applications for both web and React Native requires careful architectural decisions about **how to structure components** and **where to place business logic**. This guide provides a comprehensive framework for creating maintainable, scalable, and testable cross-platform components.

### Key Principles

**🎯 Core Goal**: Write platform-specific code at the primitive level. Our `src/components/primitives/` collection handles platform differences so business components don't need to.

**📊 Code Sharing Reality**: We achieve ~90% code sharing by extracting business logic to hooks in `src/hooks/` and using shared primitives for UI consistency.

**🏗️ Architecture Philosophy**: Three platform targets (web, desktop Electron, mobile React Native) share the same component architecture and business logic while adapting UI automatically through primitives.

---

## Architectural Foundations

### Layer 1: Primitive Components (Platform-Specific)

```tsx
// Our actual primitive structure in src/components/primitives/
Button/
├── Button.web.tsx     // Uses HTML <button> with Tailwind CSS
├── Button.native.tsx  // Uses React Native <Pressable> with StyleSheet
├── types.ts           // Shared TypeScript interface
└── index.ts           // Platform resolution
```

### Layer 2: Business Logic (Shared)

```tsx
// Our actual hooks structure in src/hooks/
useSpaces(); // 100% shared across platforms
useMessages(); // 100% shared across platforms
useUserProfile(); // 100% shared across platforms
validateMessageContent(); // Pure functions in src/utils/
```

### Layer 3: Layout Components (Platform-Aware)

```tsx
// Our component patterns in src/components/
SpaceHeader.tsx; // Single component using primitives + responsive detection
MessageComposer.web.tsx; // Desktop-specific layout with hover interactions
MessageComposer.native.tsx; // Mobile-specific layout with touch gestures
```

---

## Decision Framework: One vs Two Components

This framework aligns with the practical guidance in [Component Management Guide](./component-management-guide.md).

**Related Documentation:**
- [Primitives Overview](./features/primitives/INDEX.md) - Complete primitives documentation
- [API Reference](./features/primitives/API-REFERENCE.md) - Quick prop lookup
- [Quick Reference](../QUICK-REFERENCE.md) - Fast lookup for common patterns

### Use Single Shared Component When:

**✅ Criteria:**

- Component only uses our primitives (no raw HTML)
- Layout differences can be handled with responsive detection
- Business logic is already extracted to hooks in `src/hooks/`
- Component complexity stays manageable (~100 lines or less)

**📝 Example Structure:**

```tsx
// UserProfile.tsx - Single component using our primitives
import { FlexColumn, Container, Text, Button } from '../primitives';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useUserProfile } from '../hooks/useUserProfile';

export function UserProfile({ userId }) {
  const { isMobile } = useResponsiveLayoutContext();

  // ✅ Business logic extracted to hook
  const { user, updateUser, isLoading } = useUserProfile(userId);

  // UI state stays in component
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) return <Text>Loading...</Text>;

  return (
    <Container className={isMobile ? 'p-4' : 'p-6'}>
      <FlexColumn gap={isMobile ? 'md' : 'lg'}>
        <Text variant="heading" size={isMobile ? 'lg' : 'xl'}>
          {user.name}
        </Text>

        {isMobile ? (
          <MobileProfileLayout user={user} onEdit={() => setIsEditing(true)} />
        ) : (
          <DesktopProfileLayout user={user} onEdit={() => setIsEditing(true)} />
        )}
      </FlexColumn>
    </Container>
  );
}
```

### Use Separate Platform Components When:

**✅ Criteria:**

- Deep OS integration needs (file system, notifications, camera)
- Platform-specific gestures/interactions (swipe vs hover)
- Performance-critical sections requiring native optimization
- Would require excessive conditional rendering (>50% of component)
- Component exceeds ~150 lines with conditional logic

**📝 Example Structure:**

```tsx
// hooks/useSpaceHeader.ts - Shared business logic
export function useSpaceHeader(spaceId: string) {
  const [space, setSpace] = useState(null);
  const [memberCount, setMemberCount] = useState(0);

  // All business logic here - 100% shared
  useEffect(() => {
    Promise.all([fetchSpace(spaceId), fetchMemberCount(spaceId)]).then(
      ([spaceData, count]) => {
        setSpace(spaceData);
        setMemberCount(count);
      }
    );
  }, [spaceId]);

  return { space, memberCount, updateSpace };
}

// SpaceHeader.web.tsx - Desktop layout using our primitives
import { FlexBetween, Text, Button, Container } from '../primitives';

export function SpaceHeader({ spaceId }) {
  const { space, memberCount } = useSpaceHeader(spaceId);

  // ✅ Only UI logic specific to desktop
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <Container className="space-header-desktop">
      <FlexBetween>
        <Text variant="heading" size="xl">
          {space?.name}
        </Text>
        <Button variant="subtle" onClick={() => setShowDropdown(!showDropdown)}>
          Settings
        </Button>
      </FlexBetween>
    </Container>
  );
}

// SpaceHeader.native.tsx - Mobile layout using our primitives
import { FlexColumn, FlexRow, Text, Button } from '../primitives';

export function SpaceHeader({ spaceId }) {
  const { space, memberCount } = useSpaceHeader(spaceId); // Same hook!

  // ✅ Only UI logic specific to mobile
  const [showActions, setShowActions] = useState(false);

  return (
    <FlexColumn gap="sm" style={styles.mobileHeader}>
      <Text variant="heading" size="lg">
        {space?.name}
      </Text>
      <FlexRow gap="xs">
        <Text variant="subtle">{memberCount} members</Text>
        <Button size="small" onPress={() => setShowActions(!showActions)}>
          ⋯
        </Button>
      </FlexRow>
    </FlexColumn>
  );
}
```

---

## Logic Classification & Extraction

### Business Logic: ALWAYS Extract to Hooks

Following our [Component Management Guide](./component-management-guide.md#business-logic-extraction-rule), ALL business logic must be extracted to hooks in `src/hooks/`.

**🔄 Must Extract to `src/hooks/`:**

- **Data fetching**: API calls, WebSocket connections, caching
- **Business rules**: User permissions, message validation, space management
- **State management**: User profiles, space data, message history
- **Side effects**: Analytics tracking, notifications, file uploads

**📝 Example from Our Codebase:**

```tsx
// ❌ Business logic mixed in component
export function SpaceView({ spaceId }) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);

  // ❌ Extract this to src/hooks/
  useEffect(() => {
    fetchSpaceMessages(spaceId).then(setMessages);
    fetchSpaceMembers(spaceId).then(setMembers);
  }, [spaceId]);

  const canManageSpace = (userId) => {
    // ❌ Extract this business rule
    return members.find((m) => m.id === userId)?.role === 'admin';
  };

  return <div>...</div>;
}

// ✅ Business logic extracted to our hooks structure
// src/hooks/useSpaceData.ts
export function useSpaceData(spaceId: string) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSpaceMessages(spaceId)
      .then(setMessages)
      .finally(() => setIsLoading(false));
  }, [spaceId]);

  return { messages, isLoading };
}

// src/hooks/useSpacePermissions.ts
export function useSpacePermissions(spaceId: string, userId: string) {
  const { members } = useSpaceMembers(spaceId);

  const canManageSpace = useCallback(() => {
    return members.find((m) => m.id === userId)?.role === 'admin';
  }, [members, userId]);

  const canDeleteMessages = useCallback(() => {
    const userMember = members.find((m) => m.id === userId);
    return userMember?.role === 'admin' || userMember?.role === 'moderator';
  }, [members, userId]);

  return { canManageSpace, canDeleteMessages };
}

// ✅ Clean component using our primitives and extracted logic
import { FlexColumn, Text, Container } from '../primitives';

export function SpaceView({ spaceId }) {
  const { messages, isLoading } = useSpaceData(spaceId);
  const { canManageSpace } = useSpacePermissions(spaceId, currentUser.id);

  // Only UI logic remains
  if (isLoading) return <Text>Loading...</Text>;

  return (
    <Container>
      <FlexColumn gap="md">
        <SpaceMessageList messages={messages} canManage={canManageSpace()} />
      </FlexColumn>
    </Container>
  );
}
```

### UI Logic: Keep in Components

The [Component Management Guide](./component-management-guide.md#business-logic-extraction-rule) covers this in detail. Key points:

**✅ Keep in Components:**

- **UI state**: Modal visibility, input focus, hover states
- **Event handling**: Click handlers, form submissions
- **UI calculations**: Show/hide logic, formatting for display
- **Render logic**: Conditional rendering based on UI state

**See the Component Management Guide for complete examples and implementation details.**

### Pure Business Functions: Maximum Extractability

Pure functions go in `src/utils/` and should contain no React dependencies:

```tsx
// src/utils/messageValidation.ts - Pure functions
export function validateMessageContent(content: string): ValidationResult {
  if (!content.trim()) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (content.length > MESSAGE_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Message too long (max ${MESSAGE_MAX_LENGTH})`,
    };
  }

  return { isValid: true };
}

export function calculateSpacePermissions(
  user: User,
  space: Space
): SpacePermissions {
  if (user.globalRole === 'admin') return ALL_PERMISSIONS;

  const spaceMember = space.members.find((m) => m.userId === user.id);
  return getRolePermissions(spaceMember?.role || 'member');
}

// src/hooks/useMessageValidation.ts - Hook uses pure functions
export function useMessageValidation(spaceId: string) {
  const { space } = useSpaceData(spaceId);

  const validate = useCallback(
    (content: string) => {
      return validateMessageContent(content); // Uses pure function
    },
    [space]
  );

  return { validate };
}
```

---

## Implementation Patterns

### Pattern 1: Responsive Single Component

**Use Case**: Similar layouts with minor differences

```tsx
// Component.tsx - Single file with platform detection
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export function UserCard({ userId }) {
  const { isMobile, isTablet } = useResponsiveLayout();

  // Shared business logic
  const { user, updateUser, isLoading } = useUser(userId);

  // UI state specific to this component
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  if (isLoading) return <LoadingSpinner />;

  return (
    <Card className={isMobile ? 'user-card-mobile' : 'user-card-desktop'}>
      <FlexRow gap={isMobile ? 'sm' : 'md'}>
        <Avatar src={user.avatar} size={isMobile ? 'md' : 'lg'} />

        <FlexColumn flex={1}>
          <Text size={isMobile ? 'lg' : 'xl'} weight="bold">
            {user.name}
          </Text>

          {isMobile ? (
            // Mobile: Collapsible details
            <>
              <Button
                variant="subtle"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Show Less' : 'Show More'}
              </Button>
              {isExpanded && <UserDetails user={user} />}
            </>
          ) : (
            // Desktop: Always visible details
            <UserDetails user={user} />
          )}
        </FlexColumn>
      </FlexRow>
    </Card>
  );
}
```

### Pattern 2: Platform-Specific Components with Shared Logic

**Use Case**: Fundamentally different layouts or interactions

```tsx
// hooks/useChannelChat.ts - 100% shared business logic
export function useChannelChat(channelId: string) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [typing, setTyping] = useState([]);

  // All business logic: data fetching, WebSocket, etc.
  useEffect(() => {
    const ws = new WebSocket(`ws://api.com/channels/${channelId}`);
    ws.onmessage = handleMessage;
    return () => ws.close();
  }, [channelId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const message = await api.sendMessage(channelId, content);
      setMessages((prev) => [...prev, message]);
    },
    [channelId]
  );

  return { messages, members, typing, sendMessage };
}

// ChannelChat.web.tsx - Desktop: Sidebar layout
export function ChannelChat({ channelId }) {
  const chat = useChannelChat(channelId); // Shared logic

  // Desktop-specific UI state
  const [showMembersList, setShowMembersList] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);

  return (
    <FlexRow height="100vh">
      {/* Desktop: Always visible sidebar */}
      <ChannelSidebar
        members={chat.members}
        visible={showMembersList}
        onToggle={setShowMembersList}
      />

      <FlexColumn flex={1}>
        <MessageList
          messages={chat.messages}
          onMessageSelect={setSelectedMessage}
          selectedMessage={selectedMessage}
        />

        <MessageInput onSend={chat.sendMessage} typingUsers={chat.typing} />
      </FlexColumn>
    </FlexRow>
  );
}

// ChannelChat.native.tsx - Mobile: Stack navigation
export function ChannelChat({ channelId, navigation }) {
  const chat = useChannelChat(channelId); // Same shared logic

  // Mobile-specific UI state
  const [showActionSheet, setShowActionSheet] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `# ${chat.channelName}`,
      headerRight: () => (
        <IconButton
          name="users"
          onPress={() =>
            navigation.navigate('ChannelMembers', {
              members: chat.members,
            })
          }
        />
      ),
    });
  }, [navigation, chat.channelName, chat.members]);

  return (
    <View style={styles.container}>
      <MessageList
        messages={chat.messages}
        onLongPress={(message) => setShowActionSheet(message)}
      />

      <MessageInput onSend={chat.sendMessage} typingUsers={chat.typing} />

      {showActionSheet && (
        <ActionSheet
          message={showActionSheet}
          onClose={() => setShowActionSheet(false)}
        />
      )}
    </View>
  );
}
```

### Pattern 3: Hook Composition for Complex Logic

<cite index="32-1">One powerful aspect of custom hooks is that they can be composed to create more complex logic. By combining multiple custom hooks, you can build sophisticated business logic while keeping your UI components clean and focused.</cite>

```tsx
// Individual focused hooks
export function useChannelData(channelId: string) {
  // Data fetching logic
}

export function useChannelPermissions(channelId: string, userId: string) {
  // Permission checking logic
}

export function useChannelMessaging(channelId: string) {
  // Message sending/receiving logic
}

export function useChannelPresence(channelId: string) {
  // User presence and typing indicators
}

// Composed master hook
export function useChannel(channelId: string) {
  const data = useChannelData(channelId);
  const permissions = useChannelPermissions(channelId, currentUser.id);
  const messaging = useChannelMessaging(channelId);
  const presence = useChannelPresence(channelId);

  return {
    ...data,
    ...permissions,
    ...messaging,
    ...presence,
  };
}

// Components can use either approach:
export function SimpleComponent({ channelId }) {
  // Option A: Composed hook (simpler)
  const channel = useChannel(channelId);

  return <ChannelView {...channel} />;
}

export function AdvancedComponent({ channelId }) {
  // Option B: Individual hooks (more control)
  const { messages } = useChannelData(channelId);
  const { canDelete } = useChannelPermissions(channelId, currentUser.id);

  return <AdvancedChannelView messages={messages} canDelete={canDelete} />;
}
```

---

## Best Practices

### 1. Platform Detection Strategy

We use our centralized platform utilities in `src/utils/platform.ts` for all platform detection needs:

```tsx
// Our actual platform utilities
import {
  isWeb,
  isMobile,
  isElectron,
  getPlatform,
  isTouchDevice,
} from '../utils/platform';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

// Platform environment detection
if (isWeb()) {
  // Web browser code
}
if (isMobile()) {
  // React Native environment
  // Mobile app code
}
if (isElectron()) {
  // Electron desktop app code
}

// Screen size detection (viewport-based)
const {
  isMobile: isSmallScreen,
  isTablet,
  isDesktop,
} = useResponsiveLayoutContext();

// Touch capability detection
const hasTouch = isTouchDevice();

// Combined platform features
const platform = getPlatform(); // 'web' | 'mobile' | 'electron'
```

### 2. Custom Hook Naming and Structure

<cite index="38-1">A custom Hook is a JavaScript function whose name starts with "use" and that may call other Hooks.</cite>

```tsx
// ✅ Good: Focused, single-responsibility hooks
export function useUserProfile(userId: string) {
  /* ... */
}
export function useUserPermissions(userId: string) {
  /* ... */
}
export function useUserPreferences(userId: string) {
  /* ... */
}

// ❌ Bad: Kitchen sink hook
export function useUserEverything(userId: string) {
  /* ... */
}

// ✅ Good: Clear naming convention
export function useChannelData(channelId: string) {
  /* ... */
}
export function useChannelActions(channelId: string) {
  /* ... */
}
export function useChannelRealtime(channelId: string) {
  /* ... */
}
```

### 3. Dependency Injection for Testing

<cite index="29-1">We adjust the function to accept a new "dependencies" parameter with the relevant service functions. Then we create a custom hook that "injects" these dependencies.</cite>

```tsx
// Pure business function with dependency injection
export async function sendMessage(
  channelId: string,
  content: string,
  dependencies: {
    api: ApiService;
    analytics: AnalyticsService;
    notifications: NotificationService;
  }
) {
  const { api, analytics, notifications } = dependencies;

  try {
    const message = await api.sendMessage(channelId, content);
    analytics.track('message_sent', {
      channelId,
      messageLength: content.length,
    });
    return message;
  } catch (error) {
    notifications.showError('Failed to send message');
    throw error;
  }
}

// Hook provides dependencies
export function useChannelMessaging(channelId: string) {
  const sendMessageWithDeps = useCallback(
    async (content: string) => {
      return sendMessage(channelId, content, {
        api: apiService,
        analytics: analyticsService,
        notifications: notificationService,
      });
    },
    [channelId]
  );

  return { sendMessage: sendMessageWithDeps };
}

// Testing becomes easy
describe('sendMessage', () => {
  it('should send message and track analytics', async () => {
    const mockApi = { sendMessage: jest.fn().mockResolvedValue({ id: '123' }) };
    const mockAnalytics = { track: jest.fn() };
    const mockNotifications = { showError: jest.fn() };

    await sendMessage('channel-1', 'Hello', {
      api: mockApi,
      analytics: mockAnalytics,
      notifications: mockNotifications,
    });

    expect(mockApi.sendMessage).toHaveBeenCalledWith('channel-1', 'Hello');
    expect(mockAnalytics.track).toHaveBeenCalledWith('message_sent', {
      channelId: 'channel-1',
      messageLength: 5,
    });
  });
});
```

### 4. Performance Optimization

<cite index="36-1">Use useMemo and useCallback hooks to memoize expensive computations and callback functions, respectively. This helps avoid recalculating values or recreating functions unnecessarily.</cite>

```tsx
export function useChannelData(channelId: string) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);

  // Memoize expensive calculations
  const messagesByDate = useMemo(() => {
    return groupMessagesByDate(messages); // Expensive operation
  }, [messages]);

  const onlineMembers = useMemo(() => {
    return members.filter((member) => member.isOnline);
  }, [members]);

  // Memoize callback functions
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMemberStatus = useCallback(
    (userId: string, isOnline: boolean) => {
      setMembers((prev) =>
        prev.map((member) =>
          member.id === userId ? { ...member, isOnline } : member
        )
      );
    },
    []
  );

  return {
    messages,
    messagesByDate,
    members,
    onlineMembers,
    addMessage,
    updateMemberStatus,
  };
}
```

### 5. Error Boundaries and Error Handling

```tsx
// Error handling in hooks
export function useChannelData(channelId: string) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setError(null);
        setIsLoading(true);

        const data = await api.fetchChannelMessages(channelId);

        if (!cancelled) {
          setMessages(data.messages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  return { messages, error, isLoading };
}

// Error boundary for components
export class ChannelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
```

---

## Testing Strategies

### Testing with Our Playground System

**Web Testing (Primary):**

1. Run `yarn dev` to start development server
2. Navigate to `/playground` for primitive testing
3. Test components with different props, themes, and screen sizes
4. Verify responsive behavior and theme switching

**Mobile Testing (When Needed):**

1. Run `yarn mobile` to start mobile test playground
2. Use Expo Go app to test on real device
3. Navigate through test screens to verify mobile behavior
4. Test touch interactions and native platform integration

### 1. Testing Pure Business Functions

```tsx
// src/utils/__tests__/messageValidation.test.ts
import { validateMessageContent } from '../messageValidation';

describe('validateMessageContent', () => {
  it('should validate normal messages', () => {
    const result = validateMessageContent('Hello world');
    expect(result.isValid).toBe(true);
  });

  it('should reject empty messages', () => {
    const result = validateMessageContent('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Message cannot be empty');
  });

  it('should reject messages that are too long', () => {
    const longMessage = 'a'.repeat(1001); // Assuming 1000 char limit
    const result = validateMessageContent(longMessage);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('too long');
  });
});
```

### 2. Testing Custom Hooks

```tsx
// src/hooks/__tests__/useSpaceData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useSpaceData } from '../useSpaceData';

// Mock our API service
jest.mock('../../services/api', () => ({
  fetchSpaceMessages: jest.fn(),
  fetchSpaceMembers: jest.fn(),
}));

describe('useSpaceData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch space data on mount', async () => {
    const mockMessages = [{ id: '1', content: 'Hello space!' }];
    const mockMembers = [{ id: 'user1', name: 'Alice' }];

    api.fetchSpaceMessages.mockResolvedValue({ messages: mockMessages });
    api.fetchSpaceMembers.mockResolvedValue({ members: mockMembers });

    const { result } = renderHook(() => useSpaceData('space-123'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toEqual(mockMessages);
    expect(result.current.members).toEqual(mockMembers);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error');
    api.fetchSpaceMessages.mockRejectedValue(error);

    const { result } = renderHook(() => useSpaceData('space-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.messages).toEqual([]);
  });
});
```

### 3. Testing Platform-Specific Components

```tsx
// src/components/__tests__/SpaceChat.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SpaceChat } from '../SpaceChat';

// Mock our hooks
jest.mock('../../hooks/useSpaceChat', () => ({
  useSpaceChat: () => ({
    messages: [{ id: '1', content: 'Hello space!', author: { name: 'Alice' } }],
    sendMessage: jest.fn(),
    members: [{ id: 'user1', name: 'Alice' }],
  }),
}));

// Mock our primitives
jest.mock('../primitives', () => ({
  FlexColumn: ({ children, ...props }) => (
    <div data-testid="flex-column" {...props}>
      {children}
    </div>
  ),
  Text: ({ children, ...props }) => <span {...props}>{children}</span>,
  Button: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder, ...props }) => (
    <input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

describe('SpaceChat', () => {
  it('should render messages using our primitives', () => {
    render(<SpaceChat spaceId="space-123" />);

    expect(screen.getByText('Hello space!')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByTestId('flex-column')).toBeInTheDocument();
  });

  it('should handle message sending with our Input primitive', () => {
    const mockSendMessage = jest.fn();

    render(<SpaceChat spaceId="space-123" />);

    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'New space message' } });
    fireEvent.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalledWith('New space message');
  });
});
```

---

## Common Patterns & Examples

### 1. Space Header Pattern (Real Example)

This is the actual pattern used in our app - see the complete implementation in `src/components/SpaceHeader/`.

```tsx
// src/hooks/useSpaceHeader.ts - Shared business logic
export function useSpaceHeader(spaceId: string) {
  const [space, setSpace] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [userRole, setUserRole] = useState('member');

  useEffect(() => {
    Promise.all([
      fetchSpace(spaceId),
      fetchSpaceMemberCount(spaceId),
      fetchUserSpaceRole(spaceId, currentUser.id),
    ]).then(([spaceData, count, role]) => {
      setSpace(spaceData);
      setMemberCount(count);
      setUserRole(role);
    });
  }, [spaceId]);

  const canManageSpace = userRole === 'admin' || userRole === 'moderator';

  return { space, memberCount, userRole, canManageSpace };
}

// SpaceHeader.web.tsx - Desktop: Uses our primitives
import { Container, FlexBetween, Text, Button } from '../primitives';

export function SpaceHeader({ spaceId }) {
  const { space, memberCount, canManageSpace } = useSpaceHeader(spaceId);

  return (
    <Container className="space-header-desktop bg-surface-0 border-b border-default">
      <FlexBetween className="p-4">
        <FlexColumn gap="xs">
          <Text variant="heading" size="xl" className="text-strong">
            {space?.name}
          </Text>
          <Text variant="subtle" size="sm">
            {memberCount} members
          </Text>
        </FlexColumn>

        {canManageSpace && (
          <Button variant="subtle" onClick={() => openSpaceSettings(spaceId)}>
            Settings
          </Button>
        )}
      </FlexBetween>
    </Container>
  );
}

// SpaceHeader.native.tsx - Mobile: Uses our primitives with StyleSheet
import { FlexColumn, FlexRow, Text, Button } from '../primitives';
import { StyleSheet } from 'react-native';

export function SpaceHeader({ spaceId }) {
  const { space, memberCount, canManageSpace } = useSpaceHeader(spaceId);

  return (
    <FlexColumn style={styles.container}>
      <FlexRow style={styles.titleSection}>
        <FlexColumn style={styles.titleContainer}>
          <Text variant="heading" size="lg" style={styles.spaceName}>
            {space?.name}
          </Text>
          <Text variant="subtle" size="sm" style={styles.memberCount}>
            {memberCount} members
          </Text>
        </FlexColumn>

        {canManageSpace && (
          <Button
            variant="subtle"
            size="small"
            onPress={() => openSpaceSettings(spaceId)}
          >
            ⋯
          </Button>
        )}
      </FlexRow>
    </FlexColumn>
  );
}

// Using our theming system from src/components/primitives/theme/colors.ts
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  titleSection: {
    padding: 16,
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
});
```

### 2. Message Component with Actions

```tsx
// hooks/useMessage.ts - Shared message logic
export function useMessage(messageId: string) {
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMessage(messageId)
      .then(setMessage)
      .finally(() => setIsLoading(false));
  }, [messageId]);

  const updateMessage = useCallback(
    async (newContent: string) => {
      const updated = await api.updateMessage(messageId, newContent);
      setMessage(updated);
      return updated;
    },
    [messageId]
  );

  const deleteMessage = useCallback(async () => {
    await api.deleteMessage(messageId);
    setMessage(null);
  }, [messageId]);

  return { message, isLoading, updateMessage, deleteMessage };
}

// hooks/useMessageActions.ts - Message actions logic
export function useMessageActions(messageId: string) {
  const { canEdit, canDelete } = useMessagePermissions(messageId);

  const actions = useMemo(() => {
    const availableActions = [];

    availableActions.push({ id: 'reply', label: 'Reply', icon: 'reply' });
    availableActions.push({
      id: 'react',
      label: 'Add Reaction',
      icon: 'smile',
    });

    if (canEdit) {
      availableActions.push({ id: 'edit', label: 'Edit', icon: 'edit' });
    }

    if (canDelete) {
      availableActions.push({
        id: 'delete',
        label: 'Delete',
        icon: 'trash',
        danger: true,
      });
    }

    availableActions.push({ id: 'copy', label: 'Copy Link', icon: 'link' });

    return availableActions;
  }, [canEdit, canDelete]);

  return { actions };
}

// Message.tsx - Shared component with platform detection
export function Message({ messageId }) {
  const { isMobile } = useResponsiveLayout();
  const { message, isLoading } = useMessage(messageId);
  const { actions } = useMessageActions(messageId);

  // UI state
  const [showActions, setShowActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (isLoading) return <MessageSkeleton />;
  if (!message) return null;

  const shouldShowActions = isMobile ? showActions : isHovered;

  return (
    <FlexRow
      gap="md"
      className="message group"
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onLongPress={() => isMobile && setShowActions(true)}
    >
      <Avatar src={message.author.avatar} size="md" />

      <FlexColumn flex={1} gap="xs">
        <FlexRow gap="sm" align="center">
          <Text weight="semibold" size="sm">
            {message.author.name}
          </Text>
          <Text size="xs" color="subtle">
            {formatTimestamp(message.createdAt)}
          </Text>
        </FlexRow>

        <Text>{message.content}</Text>

        {message.reactions?.length > 0 && (
          <MessageReactions reactions={message.reactions} />
        )}
      </FlexColumn>

      {/* Actions appear on hover (desktop) or long press (mobile) */}
      {shouldShowActions && (
        <MessageActionsMenu
          actions={actions}
          onAction={(actionId) => {
            handleAction(actionId, message);
            setShowActions(false);
          }}
          onClose={() => setShowActions(false)}
          positioning={isMobile ? 'bottom-sheet' : 'tooltip'}
        />
      )}
    </FlexRow>
  );
}
```

### 3. Form with Validation

```tsx
// business/validation.ts - Pure validation functions
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
}

export function validateField(
  value: any,
  rules: ValidationRule
): ValidationResult {
  if (rules.required && (!value || value.toString().trim() === '')) {
    return { valid: false, error: 'This field is required' };
  }

  if (rules.minLength && value.length < rules.minLength) {
    return { valid: false, error: `Minimum length is ${rules.minLength}` };
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    return { valid: false, error: `Maximum length is ${rules.maxLength}` };
  }

  if (rules.pattern && !rules.pattern.test(value)) {
    return { valid: false, error: 'Invalid format' };
  }

  if (rules.custom && !rules.custom(value)) {
    return { valid: false, error: 'Invalid value' };
  }

  return { valid: true };
}

// hooks/useForm.ts - Form state management
export function useForm<T>(
  initialValues: T,
  validationRules: Record<keyof T, ValidationRule>
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string>>({});
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({});

  const validateForm = useCallback(() => {
    const newErrors = {} as Record<keyof T, string>;
    let isValid = true;

    Object.keys(validationRules).forEach((field) => {
      const fieldKey = field as keyof T;
      const result = validateField(values[fieldKey], validationRules[fieldKey]);

      if (!result.valid) {
        newErrors[fieldKey] = result.error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validationRules]);

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void) => {
      return (e?: React.FormEvent) => {
        e?.preventDefault();

        if (validateForm()) {
          onSubmit(values);
        }
      };
    },
    [values, validateForm]
  );

  return {
    values,
    errors,
    touched,
    setValue,
    validateForm,
    handleSubmit,
    isValid: Object.keys(errors).length === 0,
  };
}

// CreateChannelForm.tsx - Form using shared logic
export function CreateChannelForm({ onSubmit, onCancel }) {
  const form = useForm(
    { name: '', description: '', isPrivate: false },
    {
      name: { required: true, minLength: 1, maxLength: 50 },
      description: { maxLength: 500 },
    }
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FlexColumn gap="md">
        <InputField
          label="Channel Name"
          value={form.values.name}
          onChange={(value) => form.setValue('name', value)}
          error={form.touched.name ? form.errors.name : undefined}
          placeholder="Enter channel name"
          required
        />

        <TextAreaField
          label="Description"
          value={form.values.description}
          onChange={(value) => form.setValue('description', value)}
          error={form.touched.description ? form.errors.description : undefined}
          placeholder="Optional description"
          rows={3}
        />

        <SwitchField
          label="Private Channel"
          description="Only invited members can see this channel"
          checked={form.values.isPrivate}
          onChange={(checked) => form.setValue('isPrivate', checked)}
        />

        <FlexRow gap="sm" justify="end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.isValid}
            loading={form.isSubmitting}
          >
            Create Channel
          </Button>
        </FlexRow>
      </FlexColumn>
    </form>
  );
}
```

---

## Performance Considerations

### 1. Memoization Strategies

```tsx
// Heavy computation memoization
export function useChannelAnalytics(channelId: string) {
  const { messages } = useChannelData(channelId);

  // Expensive calculations - memoize them
  const analytics = useMemo(() => {
    const messageCount = messages.length;
    const userActivity = calculateUserActivity(messages); // Expensive
    const timeDistribution = calculateTimeDistribution(messages); // Expensive
    const popularEmojis = extractPopularEmojis(messages); // Expensive

    return {
      messageCount,
      userActivity,
      timeDistribution,
      popularEmojis,
    };
  }, [messages]);

  return analytics;
}

// Callback memoization to prevent child re-renders
export function MessageList({ messages, onMessageAction }) {
  // Memoize the callback to prevent MessageItem re-renders
  const handleMessageAction = useCallback(
    (messageId: string, action: string) => {
      onMessageAction(messageId, action);
    },
    [onMessageAction]
  );

  return (
    <VirtualList
      data={messages}
      renderItem={({ item: message }) => (
        <MessageItem
          key={message.id}
          message={message}
          onAction={handleMessageAction} // Stable reference
        />
      )}
    />
  );
}
```

### 2. Virtual Scrolling for Large Lists

```tsx
// hooks/useVirtualizedMessages.ts
export function useVirtualizedMessages(channelId: string) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMoreMessages = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const response = await api.fetchMessages(channelId, {
        before: messages[0]?.id,
        limit: 50,
      });

      setMessages((prev) => [...response.messages, ...prev]);
      setHasMore(response.hasMore);
    } finally {
      setIsLoading(false);
    }
  }, [channelId, messages, isLoading, hasMore]);

  return { messages, hasMore, isLoading, loadMoreMessages };
}

// MessageList with virtualization
export function MessageList({ channelId }) {
  const { messages, hasMore, loadMoreMessages } =
    useVirtualizedMessages(channelId);

  return (
    <VirtualList
      data={messages}
      renderItem={({ item, index }) => (
        <MessageItem
          message={item}
          isFirstMessage={index === 0}
          isLastMessage={index === messages.length - 1}
        />
      )}
      onEndReached={loadMoreMessages}
      onEndReachedThreshold={0.1}
      ListFooterComponent={hasMore ? <LoadingSpinner /> : null}
      getItemLayout={(data, index) => ({
        length: 60, // Estimated message height
        offset: 60 * index,
        index,
      })}
    />
  );
}
```

### 3. Code Splitting and Lazy Loading

```tsx
// Lazy load heavy components
const UserSettingsModal = lazy(() => import('./UserSettingsModal'));
const EmojiPicker = lazy(() => import('./EmojiPicker'));
const FileUploadDialog = lazy(() => import('./FileUploadDialog'));

export function ChatInterface() {
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <div>
      <ChatMessages />
      <MessageInput onEmojiClick={() => setShowEmojiPicker(true)} />

      {/* Lazy load modals only when needed */}
      <Suspense fallback={<ModalSkeleton />}>
        {showSettings && (
          <UserSettingsModal
            visible={showSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showEmojiPicker && (
          <EmojiPicker
            visible={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </Suspense>
    </div>
  );
}
```

---

## Migration Strategies

### 1. Incremental Migration Approach

```tsx
// Phase 1: Extract business logic to hooks
// Before: Monolithic component
export function Channel({ channelId }) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    // 100+ lines of business logic
  }, [channelId]);

  const handleSendMessage = async (content) => {
    // 50+ lines of business logic
  };

  return <div>{/* 200+ lines of JSX */}</div>;
}

// After Phase 1: Logic extracted to hooks
export function Channel({ channelId }) {
  // ✅ Business logic extracted
  const { messages, members } = useChannelData(channelId);
  const { sendMessage } = useChannelMessaging(channelId);

  return <div>{/* Same JSX, but now using shared logic */}</div>;
}

// Phase 2: Create platform-specific versions if needed
// Channel.web.tsx
export function Channel({ channelId }) {
  const channelLogic = useChannel(channelId);

  return <DesktopChannelLayout {...channelLogic} />;
}

// Channel.native.tsx
export function Channel({ channelId }) {
  const channelLogic = useChannel(channelId); // Same logic!

  return <MobileChannelLayout {...channelLogic} />;
}
```

### 2. Feature Flag Driven Migration

```tsx
// Gradual rollout using feature flags
export function UserProfile({ userId }) {
  const { useNewArchitecture } = useFeatureFlags();

  if (useNewArchitecture) {
    // New: Uses extracted hooks and shared logic
    return <UserProfileV2 userId={userId} />;
  }

  // Old: Legacy implementation
  return <UserProfileV1 userId={userId} />;
}

// Test both versions in production
export function UserProfileV2({ userId }) {
  const { user, updateUser } = useUser(userId);
  const { permissions } = useUserPermissions(userId);

  return (
    <UserProfileLayout
      user={user}
      permissions={permissions}
      onUpdate={updateUser}
    />
  );
}
```

### 3. Component Wrapper Strategy

```tsx
// Temporary wrapper during migration
export function LegacyChannelWrapper({ channelId }) {
  // Extract logic gradually
  const { messages } = useChannelData(channelId);

  // Keep using legacy component with new data
  return (
    <LegacyChannel
      channelId={channelId}
      messages={messages} // New: From hook
      // Other props passed through from legacy usage
    />
  );
}

// Eventually replace entirely
export function Channel({ channelId }) {
  const channelLogic = useChannel(channelId);

  return <NewChannelLayout {...channelLogic} />;
}
```

---

## Conclusion

Creating effective cross-platform React components requires careful consideration of **architecture**, **logic separation**, and **platform-specific requirements**. The key principles are:

1. **Write platform-specific code at the lowest level possible** - in primitives
2. **Extract all business logic to shared hooks** for maximum code reuse
3. **Keep UI logic in components** where it belongs
4. **Use the decision framework** to choose between shared vs separate components
5. **Test business logic independently** from UI components
6. **Optimize performance** with proper memoization and virtualization

By following these patterns and best practices, you can achieve <cite index="27-1">87% code reuse across platforms</cite> while maintaining native user experiences on both web and mobile.

The investment in proper architecture pays dividends in **maintainability**, **testability**, and **developer productivity** as your cross-platform application grows in complexity.

---

## Additional Resources

- **[Component Management Guide](./component-management-guide.md)** - Practical decisions for component creation and management
- **[Primitive Styling Guide](./primitive-styling-guide.md)** - Detailed styling guidelines for primitives
- **[When to Use Primitives](./when-to-use-primitives.md)** - Decision framework for primitive usage

---

_This guide provides architectural patterns specific to the Quilibrium desktop/mobile app. Continue refining these patterns based on user feedback and platform requirements._

_Updated: 2025-08-14 12:30 UTC_
