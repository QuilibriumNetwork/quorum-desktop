# Complete Guide: Cross-Platform React Components for Web + Native

[← Back to INDEX](/.readme/INDEX.md)

IMPORTANT: this guide is generic and may not fully adapt to the current repo. Don't just follow it blindly but always check the current situation and ask for clarification if needed.

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

**🎯 Core Goal**: <cite index="20-1">Write platform-specific code on the lowest possible level. Improve your primitive components, so you don't have to write custom styles and split code too much.</cite>

**📊 Code Sharing Reality**: <cite index="27-1">Facebook claims that their Ad Manager application has 87% code reuse across the two platforms</cite>, demonstrating that significant code sharing is achievable with the right architecture.

**🏗️ Architecture Philosophy**: <cite index="22-1">Both react and react-native being JavaScript based, with an architectural design approach you can share your business logic</cite> while keeping UI implementations platform-specific where necessary.

---

## Architectural Foundations

### Layer 1: Primitive Components (Platform-Specific)

```tsx
// Platform-specific rendering with identical APIs
Button.web.tsx; // Uses HTML <button>
Button.native.tsx; // Uses React Native <Pressable>
```

### Layer 2: Business Logic (Shared)

```tsx
// Shared hooks and business functions
useChannelData(); // 100% shared across platforms
usePermissions(); // 100% shared across platforms
validateMessage(); // Pure functions, no React dependencies
```

### Layer 3: Layout Components (Platform-Aware)

```tsx
// Either shared with responsive design OR platform-specific
Component.tsx; // Single component with conditional rendering
Component.web.tsx; // Desktop-specific layout
Component.native.tsx; // Mobile-specific layout
```

---

## Decision Framework: One vs Two Components

### Use Single Shared Component When:

**✅ Criteria:**

- Similar data requirements and interactions
- Layout differences can be handled with conditional rendering
- Complexity manageable within one component file
- <cite index="34-1">The Container and presentation pattern can separate presentation logic from business logic</cite>

**📝 Example Structure:**

```tsx
// UserProfile.tsx - Single component for both platforms
export function UserProfile({ userId }) {
  const { isMobile } = useResponsiveLayout();

  // ✅ Logic can stay - single component
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Business logic
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  // UI logic with platform detection
  return (
    <FlexColumn className={isMobile ? 'profile-mobile' : 'profile-desktop'}>
      <Avatar src={user?.avatar} size={isMobile ? 'lg' : 'xl'} />

      {isMobile ? (
        <MobileLayout user={user} isEditing={isEditing} />
      ) : (
        <DesktopLayout user={user} isEditing={isEditing} />
      )}
    </FlexColumn>
  );
}
```

### Use Separate Platform Components When:

**✅ Criteria:**

- Fundamentally different layouts or navigation patterns
- Platform-specific features (swipe gestures, hover actions)
- Different interaction paradigms (sidebar vs tabs)
- Would require excessive conditional rendering
- <cite index="23-1">When your platform-specific code is more complex, you should consider splitting the code out into separate files</cite>

**📝 Example Structure:**

```tsx
// hooks/useServerHeader.ts - Shared business logic
export function useServerHeader(serverId) {
  const [server, setServer] = useState(null);
  const [members, setMembers] = useState([]);

  // All business logic here - 100% shared
  useEffect(() => {
    fetchServerData(serverId).then(/* ... */);
  }, [serverId]);

  return { server, members, updateServer, addMember };
}

// ServerHeader.web.tsx - Desktop layout
export function ServerHeader({ serverId }) {
  const { server, updateServer } = useServerHeader(serverId);

  // ✅ Only UI logic specific to desktop
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="desktop-header">
      <ServerBanner server={server}>
        <h1>{server.name}</h1> {/* Embedded in banner */}
      </ServerBanner>
      {/* Desktop-specific controls */}
    </div>
  );
}

// ServerHeader.native.tsx - Mobile layout
export function ServerHeader({ serverId }) {
  const { server, updateServer } = useServerHeader(serverId); // Same hook!

  // ✅ Only UI logic specific to mobile
  const [activeTab, setActiveTab] = useState(0);

  return (
    <View style={styles.mobileHeader}>
      <ServerBanner server={server} /> {/* Separate from title */}
      <Text style={styles.title}>{server.name}</Text>
      <MobileActions server={server} /> {/* Mobile-only features */}
    </View>
  );
}
```

---

## Logic Classification & Extraction

### Business Logic: ALWAYS Extract to Hooks

<cite index="29-1">Business logic can bloat React components and make them difficult to test. Extracting them to hooks in combination with dependency injection can improve maintainability and testability.</cite>

**🔄 Must Extract:**

- **Data fetching**: API calls, WebSocket connections, caching
- **Business rules**: Permissions, validation, calculations
- **State management**: Data that represents business entities
- **Side effects**: Analytics, notifications, external integrations

**📝 Example:**

```tsx
// ❌ Business logic mixed in component
export function Channel({ channelId }) {
  const [messages, setMessages] = useState([]);
  const [permissions, setPermissions] = useState({});

  // ❌ Extract this to hooks
  useEffect(() => {
    fetchMessages(channelId).then(setMessages);
    fetchPermissions(channelId).then(setPermissions);
  }, [channelId]);

  const canDelete = (messageId) => {
    // ❌ Extract this business rule
    return (
      permissions.admin ||
      messages.find((m) => m.id === messageId)?.authorId === currentUser.id
    );
  };

  return <div>...</div>;
}

// ✅ Business logic extracted to shared hooks
export function useChannelData(channelId) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMessages(channelId)
      .then(setMessages)
      .finally(() => setIsLoading(false));
  }, [channelId]);

  return { messages, isLoading };
}

export function useChannelPermissions(channelId, userId) {
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    fetchPermissions(channelId, userId).then(setPermissions);
  }, [channelId, userId]);

  const canDelete = useCallback(
    (messageId, authorId) => {
      return (
        permissions.admin || (authorId === userId && permissions.canDeleteOwn)
      );
    },
    [permissions, userId]
  );

  return { permissions, canDelete };
}

// ✅ Clean component using extracted logic
export function Channel({ channelId }) {
  const { messages, isLoading } = useChannelData(channelId);
  const { canDelete } = useChannelPermissions(channelId, currentUser.id);

  // Only UI logic remains
  if (isLoading) return <LoadingSpinner />;

  return (
    <MessageList
      messages={messages}
      onDelete={(messageId, authorId) => canDelete(messageId, authorId)}
    />
  );
}
```

### UI Logic: Keep in Components

**✅ Keep in Components:**

- **UI state**: Modal visibility, input values, scroll position, hover states
- **Event handling**: Click handlers, form submissions, keyboard events
- **UI calculations**: Show/hide logic, CSS classes, formatting for display
- **Render logic**: Conditional rendering, data presentation

**📝 Example:**

```tsx
export function MessageInput({ onSend }) {
  // ✅ UI state - stays in component
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // ✅ UI event handlers - stays in component
  const handleSubmit = () => {
    if (message.trim()) {
      onSend(message); // Business logic handled by parent
      setMessage(''); // UI logic - clear input
      setShowEmojiPicker(false); // UI logic - hide picker
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMessage((prev) => prev + emoji); // UI logic - update input
    setShowEmojiPicker(false); // UI logic - hide picker
  };

  // ✅ UI calculations - stays in component
  const showSendButton = message.trim().length > 0;
  const inputPlaceholder = isFocused ? '' : 'Type a message...';

  return (
    <FlexRow gap="sm">
      <Input
        value={message}
        onChange={setMessage}
        placeholder={inputPlaceholder}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onEnter={handleSubmit}
      />

      <IconButton
        name="smile"
        active={showEmojiPicker}
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
      />

      {showSendButton && <Button onClick={handleSubmit}>Send</Button>}

      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onclose={() => setShowEmojiPicker(false)}
        />
      )}
    </FlexRow>
  );
}
```

### Pure Business Functions: Maximum Extractability

<cite index="29-1">Extract all the business logic into a new function in a new file that contains no code related to the UI or React (except for maybe the error messages that could be replaced by some kind of error codes).</cite>

**📝 Example:**

```tsx
// business/messageLogic.ts - Pure functions (no React dependencies)
export function validateMessage(content: string, rules: ChannelRules) {
  if (!content.trim()) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (content.length > rules.maxLength) {
    return { valid: false, error: `Message too long (max ${rules.maxLength})` };
  }

  if (containsProfanity(content)) {
    return { valid: false, error: 'Message contains inappropriate content' };
  }

  return { valid: true };
}

export function calculatePermissions(
  user: User,
  channel: Channel
): Permissions {
  if (user.globalRole === 'admin') return ALL_PERMISSIONS;

  const channelRole = channel.members.find((m) => m.userId === user.id)?.role;
  return getRolePermissions(channelRole || 'member');
}

// hooks/useMessageValidation.ts - Hook uses pure functions
export function useMessageValidation(channelId: string) {
  const [rules, setRules] = useState(null);

  useEffect(() => {
    fetchChannelRules(channelId).then(setRules);
  }, [channelId]);

  const validate = useCallback(
    (content: string) => {
      if (!rules) return { valid: true };
      return validateMessage(content, rules); // Uses pure function
    },
    [rules]
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

<cite index="23-1">React Native provides a module that detects the platform in which the app is running. You can use the detection logic to implement platform-specific code.</cite>

```tsx
// hooks/useResponsiveLayout.ts - Cross-platform detection
export function useResponsiveLayout() {
  const [layout, setLayout] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 0,
  });

  useEffect(() => {
    // React Native: Platform detection
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const { width } = Dimensions.get('window');
      setLayout({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        screenWidth: width,
      });
      return;
    }

    // Web: Window size detection
    const updateLayout = () => {
      const width = window.innerWidth;
      setLayout({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        screenWidth: width,
      });
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  return layout;
}
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

### 1. Testing Pure Business Functions

```tsx
// business/messageLogic.test.ts
import { validateMessage, calculatePermissions } from './messageLogic';

describe('validateMessage', () => {
  const rules = { maxLength: 100, allowProfanity: false };

  it('should validate normal messages', () => {
    const result = validateMessage('Hello world', rules);
    expect(result.valid).toBe(true);
  });

  it('should reject empty messages', () => {
    const result = validateMessage('   ', rules);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message cannot be empty');
  });

  it('should reject messages that are too long', () => {
    const longMessage = 'a'.repeat(101);
    const result = validateMessage(longMessage, rules);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message too long (max 100)');
  });
});
```

### 2. Testing Custom Hooks

```tsx
// hooks/useChannelData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useChannelData } from './useChannelData';

// Mock API
jest.mock('../services/api', () => ({
  fetchChannelMessages: jest.fn(),
}));

describe('useChannelData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch channel data on mount', async () => {
    const mockMessages = [{ id: '1', content: 'Hello' }];
    api.fetchChannelMessages.mockResolvedValue({ messages: mockMessages });

    const { result } = renderHook(() => useChannelData('channel-123'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toEqual(mockMessages);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error');
    api.fetchChannelMessages.mockRejectedValue(error);

    const { result } = renderHook(() => useChannelData('channel-123'));

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
// ChannelChat.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ChannelChat } from './ChannelChat';

// Mock hooks
jest.mock('./hooks/useChannelChat', () => ({
  useChannelChat: () => ({
    messages: [{ id: '1', content: 'Hello', author: { name: 'John' } }],
    sendMessage: jest.fn(),
    members: [{ id: 'user1', name: 'John' }],
  }),
}));

describe('ChannelChat', () => {
  it('should render messages', () => {
    render(<ChannelChat channelId="channel-123" />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('should handle message sending', () => {
    const mockSendMessage = jest.fn();

    render(<ChannelChat channelId="channel-123" />);

    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'New message' } });
    fireEvent.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalledWith('New message');
  });
});
```

---

## Common Patterns & Examples

### 1. Discord-Like Server Header

```tsx
// hooks/useServerHeader.ts - Shared business logic
export function useServerHeader(serverId: string) {
  const [server, setServer] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [userRole, setUserRole] = useState('member');

  useEffect(() => {
    Promise.all([
      fetchServer(serverId),
      fetchMemberCount(serverId),
      fetchUserRole(serverId, currentUser.id),
    ]).then(([serverData, count, role]) => {
      setServer(serverData);
      setMemberCount(count);
      setUserRole(role);
    });
  }, [serverId]);

  const canManageServer = userRole === 'admin' || userRole === 'moderator';

  return { server, memberCount, userRole, canManageServer };
}

// ServerHeader.web.tsx - Desktop: Banner with embedded title
export function ServerHeader({ serverId }) {
  const { server, memberCount, canManageServer } = useServerHeader(serverId);

  return (
    <div className="relative">
      <ServerBanner
        imageUrl={server?.bannerUrl}
        className="h-32 bg-gradient-to-r from-purple-500 to-blue-500"
      >
        {/* Desktop: Title embedded in banner */}
        <div className="absolute bottom-4 left-4">
          <Text className="text-white text-2xl font-bold drop-shadow-lg">
            {server?.name}
          </Text>
          <Text className="text-white/80 text-sm">{memberCount} members</Text>
        </div>

        {canManageServer && (
          <div className="absolute top-4 right-4">
            <IconButton
              name="cog"
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={() => openServerSettings(serverId)}
            />
          </div>
        )}
      </ServerBanner>
    </div>
  );
}

// ServerHeader.native.tsx - Mobile: Stacked layout with fixed header
export function ServerHeader({ serverId }) {
  const { server, memberCount, canManageServer } = useServerHeader(serverId);

  return (
    <View style={styles.container}>
      {/* Mobile: Banner separate from title */}
      <ServerBanner imageUrl={server?.bannerUrl} style={styles.banner} />

      {/* Mobile: Title below banner with actions */}
      <View style={styles.titleSection}>
        <View style={styles.titleContainer}>
          <Text style={styles.serverName}>{server?.name}</Text>
          <Text style={styles.memberCount}>{memberCount} members</Text>
        </View>

        {/* Mobile-specific action buttons */}
        <FlexRow gap="sm">
          <IconButton name="search" onPress={() => openSearch(serverId)} />
          <IconButton name="users" onPress={() => openMembersList(serverId)} />
          {canManageServer && (
            <IconButton
              name="cog"
              onPress={() => openServerSettings(serverId)}
            />
          )}
        </FlexRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  banner: {
    height: 120,
    backgroundColor: '#7c3aed',
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  titleContainer: {
    flex: 1,
  },
  serverName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  memberCount: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
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

_This guide synthesizes best practices from React, React Native, and cross-platform development communities. Continue refining these patterns based on your specific application needs and user feedback._
