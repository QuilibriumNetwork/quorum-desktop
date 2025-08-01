# Component Architecture Workflow - Detailed Explanation

[← Back to INDEX](../../../../INDEX.md)

## Overview

This document explains the complete workflow from primitive creation to complex component implementation for developers new to cross-platform development. It covers what happens after we finish creating primitives and how existing complex components are handled.

---

## Current State vs Future State

### **Current State (Desktop Only)**

```
src/components/
├── message/
│   ├── Message.tsx                    # Complex component with many features
│   ├── MessageActions.tsx             # Message-specific actions
│   └── MessageReactions.tsx           # Reaction system
├── channel/
│   ├── Channel.tsx                    # Channel view with message list
│   ├── ChannelHeader.tsx              # Channel header with controls
│   └── MessageInput.tsx               # Input form for sending messages
├── space/
│   ├── Space.tsx                      # Space layout and navigation
│   └── SpaceSettings.tsx              # Space configuration
└── primitives/                        # ✅ Our new primitives
    ├── Button/
    ├── Modal/
    ├── Input/
    └── VirtualList/
```

### **Future State (Cross-Platform)**

```
src/components/
├── message/
│   ├── Message.web.tsx                # Web-specific message layout
│   ├── Message.native.tsx             # Mobile-specific message layout
│   ├── MessageActions.web.tsx         # Hover actions for desktop
│   ├── MessageActions.native.tsx      # Touch actions for mobile
│   ├── MessageReactions.tsx           # Shared logic (no UI differences)
│   └── hooks/
│       ├── useMessageActions.ts       # ✅ Shared business logic
│       └── useMessageReactions.ts     # ✅ Shared business logic
├── channel/
│   ├── Channel.tsx                    # ✅ Shared (uses primitives only)
│   ├── ChannelHeader.web.tsx          # Desktop header layout
│   ├── ChannelHeader.native.tsx       # Mobile header layout
│   └── MessageInput.tsx               # ✅ Shared (uses Input primitive)
└── primitives/                        # ✅ Cross-platform primitives
    ├── Button/
    ├── Modal/
    ├── Input/
    └── VirtualList/
```

---

## The Three-Layer Architecture

### **Layer 1: Primitives (Platform-Specific Implementation)**

```tsx
// Button.web.tsx - Uses HTML button
<button className="btn-primary" onClick={onClick}>
  {children}
</button>

// Button.native.tsx - Uses React Native Pressable
<Pressable style={styles.primary} onPress={onClick}>
  <Text style={styles.text}>{children}</Text>
</Pressable>
```

### **Layer 2: Business Components (Shared Logic + Platform UI)**

```tsx
// useMessageActions.ts - Shared business logic
export const useMessageActions = (messageId: string) => {
  const handleReply = () => {
    /* business logic */
  };
  const handleReact = () => {
    /* business logic */
  };
  const handleCopy = () => {
    /* business logic */
  };

  return { handleReply, handleReact, handleCopy };
};

// MessageActions.web.tsx - Desktop UI (hover actions)
const MessageActions = ({ messageId }) => {
  const { handleReply, handleReact, handleCopy } = useMessageActions(messageId);

  return (
    <div className="message-actions-hover">
      <Button onClick={handleReply}>Reply</Button>
      <Button onClick={handleReact}>React</Button>
      <Button onClick={handleCopy}>Copy</Button>
    </div>
  );
};

// MessageActions.native.tsx - Mobile UI (long-press menu)
const MessageActions = ({ messageId }) => {
  const { handleReply, handleReact, handleCopy } = useMessageActions(messageId);

  return (
    <Modal visible={showActions} onClose={() => setShowActions(false)}>
      <Button onPress={handleReply}>Reply</Button>
      <Button onPress={handleReact}>React</Button>
      <Button onPress={handleCopy}>Copy Link</Button>
    </Modal>
  );
};
```

### **Layer 3: App Components (Pure Composition)**

```tsx
// Message.tsx - Same on both platforms (uses primitives + business components)
const Message = ({ message }) => {
  return (
    <FlexRow gap="md" className="message-container">
      <Avatar src={message.author.avatar} />
      <FlexColumn gap="sm">
        <Text>{message.author.name}</Text>
        <Text>{message.content}</Text>
        <MessageActions messageId={message.id} />
      </FlexColumn>
    </FlexRow>
  );
};
```

---

## Detailed Workflow After Primitives Are Complete

### **Phase 1: Analysis & Planning**

For each complex component, we analyze:

1. **UI Patterns**: What visual elements are used?
2. **Interactions**: How do users interact with it?
3. **Business Logic**: What functionality does it provide?
4. **Platform Differences**: What should be different on mobile?

**Example: Message.tsx Analysis**

```
✅ UI Patterns Found:
- FlexRow layout → Use FlexRow primitive
- Avatar display → Use Avatar primitive
- Buttons for actions → Use Button primitive
- Text content → Use Text primitive

✅ Interactions Found:
- Hover to show actions (desktop) → MessageActions.web.tsx
- Long-press for actions (mobile) → MessageActions.native.tsx
- Click to reply → Shared business logic

✅ Business Logic Found:
- Message formatting → useMessageFormatting hook
- Action handling → useMessageActions hook
- Reaction management → useMessageReactions hook

✅ Platform Differences:
- Desktop: Hover actions, right-click menu
- Mobile: Long-press actions, swipe gestures
```

### **Phase 2: Component Classification**

We classify each component into one of three categories:

#### **Category A: Shared Components (No Platform Differences)**

Components that work identically on both platforms using only primitives.

**Examples:**

- `MessageInput.tsx` - Just uses Input + Button primitives
- `UserProfile.tsx` - Just displays data with Text + Avatar primitives
- `ChannelList.tsx` - Just uses VirtualList + FlexColumn primitives

**Action:** ✅ Keep as single `.tsx` file, ensure it only uses primitives

#### **Category B: Platform-Specific UI Components**

Components that need different UI layouts but share business logic.

**Examples:**

- `MessageActions` - Hover menu vs bottom drawer
- `ChannelHeader` - Full header vs compact mobile header
- `SpaceNavigation` - Sidebar vs bottom tabs

**Action:** 🔄 Split into `.web.tsx` and `.native.tsx` + shared hook

#### **Category C: Complex Components Needing Refactoring**

Large components that need to be broken down into smaller pieces.

**Examples:**

- `Message.tsx` - Split into MessageContent + MessageActions + MessageReactions
- `Channel.tsx` - Split into ChannelHeader + MessageList + MessageInput
- `SpaceSettings.tsx` - Split into multiple setting sections

**Action:** 🔧 Refactor into smaller components, then apply Category A/B rules

### **Phase 3: Implementation Strategy**

#### **For Category A Components (Shared):**

```tsx
// Before: Uses raw HTML
const MessageInput = () => {
  return (
    <div className="flex gap-2">
      <input type="text" placeholder="Type message..." />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};

// After: Uses primitives (works on both platforms)
const MessageInput = () => {
  return (
    <FlexRow gap="sm">
      <Input placeholder="Type message..." />
      <Button onPress={handleSend}>Send</Button>
    </FlexRow>
  );
};
```

#### **For Category B Components (Platform-Specific UI):**

```tsx
// 1. Extract shared business logic
// hooks/useMessageActions.ts
export const useMessageActions = (messageId: string) => {
  const handleReply = useCallback(() => {
    // Business logic for replying to message
  }, [messageId]);

  const handleReact = useCallback((emoji: string) => {
    // Business logic for adding reaction
  }, [messageId]);

  return { handleReply, handleReact, actions: [...] };
};

// 2. Create platform-specific UI components
// MessageActions.web.tsx - Desktop hover menu
const MessageActions = ({ messageId }) => {
  const { handleReply, handleReact, actions } = useMessageActions(messageId);

  return (
    <div className="message-actions-hover">
      {actions.map(action => (
        <Button key={action.id} onClick={action.handler}>
          {action.label}
        </Button>
      ))}
    </div>
  );
};

// MessageActions.native.tsx - Mobile bottom drawer
const MessageActions = ({ messageId }) => {
  const { handleReply, handleReact, actions } = useMessageActions(messageId);
  const [visible, setVisible] = useState(false);

  return (
    <Modal visible={visible} onClose={() => setVisible(false)}>
      {actions.map(action => (
        <Button key={action.id} onPress={action.handler}>
          {action.label}
        </Button>
      ))}
    </Modal>
  );
};

// 3. Platform resolution happens automatically
// MessageActions/index.ts
export { MessageActions } from './MessageActions';
```

#### **For Category C Components (Complex Refactoring):**

```tsx
// Before: Monolithic Message.tsx
const Message = ({ message }) => {
  return (
    <div className="message">
      {/* 50+ lines of mixed concerns */}
      <div>{message.author.name}</div>
      <div>{message.content}</div>
      <div className="actions">
        <button onClick={handleReply}>Reply</button>
        <button onClick={handleReact}>React</button>
        {/* ... more actions */}
      </div>
      <div className="reactions">{/* ... reaction display logic */}</div>
    </div>
  );
};

// After: Composed from smaller components
const Message = ({ message }) => {
  return (
    <FlexColumn gap="sm" className="message">
      <MessageHeader author={message.author} timestamp={message.timestamp} />
      <MessageContent content={message.content} />
      <MessageActions messageId={message.id} />
      <MessageReactions messageId={message.id} reactions={message.reactions} />
    </FlexColumn>
  );
};

// Each sub-component follows Category A or B rules:
// - MessageHeader.tsx (Category A - shared)
// - MessageContent.tsx (Category A - shared)
// - MessageActions.web/native.tsx (Category B - platform-specific)
// - MessageReactions.tsx (Category A - shared)
```

---

## Component Migration Process

### **Step 1: Audit Existing Component**

```bash
# Analyze component dependencies
grep -r "import.*from" src/components/message/Message.tsx

# Find raw HTML usage
grep -r "<button\|<input\|<div\|<span" src/components/message/Message.tsx

# Check for platform-specific logic
grep -r "hover\|onMouseEnter\|click" src/components/message/Message.tsx
```

### **Step 2: Create Migration Plan**

Document for each component:

- Which primitives it needs
- What business logic can be shared
- What UI needs to be platform-specific
- How to break down complex components

### **Step 3: Implement Migration**

```bash
# 1. Create shared business logic
touch src/components/message/hooks/useMessageActions.ts

# 2. Create platform-specific UI (if needed)
touch src/components/message/MessageActions.web.tsx
touch src/components/message/MessageActions.native.tsx
touch src/components/message/MessageActions/index.ts

# 3. Update main component to use primitives
# Edit src/components/message/Message.tsx
```

### **Step 4: Test Migration**

- Test on web (should look identical to before)
- Test on mobile (should feel native)
- Test shared business logic works on both platforms

---

## Real-World Examples

### **Example 1: Simple Component (Category A)**

**MessageInput.tsx** - Sending messages

```tsx
// Current implementation
const MessageInput = () => {
  const [message, setMessage] = useState('');

  return (
    <div className="flex gap-2 p-4">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};

// After migration (works on both platforms)
const MessageInput = () => {
  const [message, setMessage] = useState('');

  return (
    <FlexRow gap="sm" className="p-4">
      <Input
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message..."
      />
      <Button onPress={handleSend}>Send</Button>
    </FlexRow>
  );
};
```

**Result:** ✅ One file, works on both platforms, no additional work needed.

### **Example 2: Platform-Specific Component (Category B)**

**MessageActions** - Reply, react, copy, etc.

```tsx
// 1. Shared business logic
// hooks/useMessageActions.ts
export const useMessageActions = (messageId: string) => {
  const handleReply = () => {
    // Navigate to reply mode
    setReplyingTo(messageId);
  };

  const handleReact = (emoji: string) => {
    // Send reaction to API
    addReaction(messageId, emoji);
  };

  const handleCopy = () => {
    // Copy message link to clipboard
    copyToClipboard(`/messages/${messageId}`);
  };

  return {
    actions: [
      { id: 'reply', label: 'Reply', handler: handleReply },
      { id: 'react', label: 'React', handler: () => setShowEmojiPicker(true) },
      { id: 'copy', label: 'Copy Link', handler: handleCopy },
    ],
  };
};

// 2. Desktop UI - Hover menu
// MessageActions.web.tsx
const MessageActions = ({ messageId }) => {
  const { actions } = useMessageActions(messageId);

  return (
    <div className="message-actions-hover opacity-0 group-hover:opacity-100">
      {actions.map((action) => (
        <Button
          key={action.id}
          type="subtle"
          size="sm"
          onClick={action.handler}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
};

// 3. Mobile UI - Bottom drawer
// MessageActions.native.tsx
const MessageActions = ({ messageId }) => {
  const { actions } = useMessageActions(messageId);
  const [showDrawer, setShowDrawer] = useState(false);

  // Triggered by long-press on message
  useEffect(() => {
    const handleLongPress = () => setShowDrawer(true);
    // ... event listener setup
  }, []);

  return (
    <Modal visible={showDrawer} onClose={() => setShowDrawer(false)}>
      <FlexColumn gap="md" className="p-4">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="primary"
            onPress={() => {
              action.handler();
              setShowDrawer(false);
            }}
          >
            {action.label}
          </Button>
        ))}
      </FlexColumn>
    </Modal>
  );
};
```

**Result:** ✅ Business logic shared, UI optimized for each platform.

### **Example 3: Complex Component Needing Refactoring (Category C)**

**Message.tsx** - Large component with many responsibilities

```tsx
// Before: 200+ line monolithic component
const Message = ({ message }) => {
  // ... tons of mixed logic
  return (
    <div className="message">
      {/* Author info */}
      <div className="message-header">
        <img src={author.avatar} />
        <span>{author.name}</span>
        <span>{formatTime(message.timestamp)}</span>
      </div>

      {/* Message content */}
      <div className="message-content">
        {message.content}
        {message.attachments?.map(/* ... */)}
      </div>

      {/* Actions */}
      <div className="message-actions">
        <button onClick={handleReply}>Reply</button>
        {/* ... 10+ more actions */}
      </div>

      {/* Reactions */}
      <div className="message-reactions">
        {/* ... complex reaction logic */}
      </div>
    </div>
  );
};

// After: Broken into focused components
const Message = ({ message }) => {
  return (
    <FlexColumn gap="sm" className="message">
      <MessageHeader author={message.author} timestamp={message.timestamp} />
      <MessageContent
        content={message.content}
        attachments={message.attachments}
      />
      <MessageActions messageId={message.id} />
      <MessageReactions messageId={message.id} reactions={message.reactions} />
    </FlexColumn>
  );
};

// Sub-components (each follows Category A or B rules):
// - MessageHeader.tsx (Category A - shared, uses Avatar + Text primitives)
// - MessageContent.tsx (Category A - shared, uses Text + Image primitives)
// - MessageActions.web/native.tsx (Category B - platform-specific UI)
// - MessageReactions.tsx (Category A - shared, uses Button + Text primitives)
```

**Result:** ✅ Easier to maintain, test, and optimize per platform.

---

## Mobile-Specific Considerations

### **Navigation Differences**

```tsx
// Desktop: Routing with react-router
const handleNavigateToProfile = () => {
  navigate(`/profile/${userId}`);
};

// Mobile: Navigation with react-navigation
const handleNavigateToProfile = () => {
  navigation.navigate('Profile', { userId });
};
```

### **Interaction Patterns**

```tsx
// Desktop: Hover states
<div className="hover:bg-gray-100" onMouseEnter={showTooltip}>

// Mobile: Touch states
<Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
```

### **Layout Adaptations**

```tsx
// Desktop: Sidebar layout
<FlexRow>
  <Sidebar />
  <MainContent />
</FlexRow>

// Mobile: Stack layout with tabs
<Stack.Navigator>
  <Stack.Screen name="Messages" component={MessagesList} />
  <Stack.Screen name="Profile" component={Profile} />
</Stack.Navigator>
```

---

## Success Metrics

### **Code Sharing Goals**

- ✅ **95%+ business logic shared** between platforms
- ✅ **80%+ UI components shared** (using primitives)
- ✅ **Platform-specific code limited to** interaction patterns and navigation

### **Development Velocity Goals**

- ✅ **New features** can be built for both platforms simultaneously
- ✅ **Bug fixes** automatically apply to both platforms
- ✅ **Design updates** propagate through primitive system

### **User Experience Goals**

- ✅ **Web app** maintains current functionality and performance
- ✅ **Mobile app** feels native, not like "web in app wrapper"
- ✅ **Consistent** design language across platforms

---

## Summary

The workflow after primitive creation involves:

1. **Analysis**: Categorize each component (Shared/Platform-Specific/Complex)
2. **Refactoring**: Break complex components into focused pieces
3. **Migration**: Replace raw HTML with primitives, extract business logic
4. **Platform Optimization**: Create platform-specific UI where needed
5. **Testing**: Ensure functionality works identically on both platforms

The key insight is that **most components become shared** once they use primitives, with only **interaction patterns and navigation** needing platform-specific implementations.

This approach gives us the best of both worlds: **code reuse for efficiency** and **platform optimization for user experience**.

---

_Last updated: 2025-07-25_  
_For questions about specific components, see the masterplan or create a GitHub issue._
