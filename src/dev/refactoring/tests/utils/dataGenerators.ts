// Data generators for testing MessageDB functionality
export const dataGenerators = {
  // Message-related data generators
  message: {
    // Basic text message
    text: (overrides = {}) => ({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      content: 'Hello, this is a test message!',
      senderId: 'user-123',
      senderName: 'Test User',
      spaceId: 'space-456',
      channelId: 'general',
      timestamp: Date.now(),
      edited: false,
      editedAt: null,
      deleted: false,
      reactions: [],
      attachments: [],
      mentions: [],
      replyTo: null,
      threadId: null,
      encrypted: false,
      encryptionKeyId: null,
      status: 'sent',
      localId: null,
      ...overrides,
    }),

    // Encrypted message
    encrypted: (overrides = {}) => ({
      ...dataGenerators.message.text(),
      encrypted: true,
      encryptionKeyId: 'key-789',
      encryptedContent: new ArrayBuffer(256),
      content: '[Encrypted]',
      ...overrides,
    }),

    // Message with attachments
    withAttachment: (overrides = {}) => ({
      ...dataGenerators.message.text(),
      attachments: [{
        id: 'att-123',
        name: 'test-file.pdf',
        size: 1024000,
        type: 'application/pdf',
        url: 'blob://test-url',
        thumbnail: null,
      }],
      ...overrides,
    }),

    // Message with reactions
    withReactions: (overrides = {}) => ({
      ...dataGenerators.message.text(),
      reactions: [
        { emoji: '👍', users: ['user-123', 'user-456'], count: 2 },
        { emoji: '❤️', users: ['user-789'], count: 1 },
      ],
      ...overrides,
    }),

    // Reply message
    reply: (originalMessageId: string, overrides = {}) => ({
      ...dataGenerators.message.text(),
      replyTo: originalMessageId,
      content: 'This is a reply to the previous message',
      ...overrides,
    }),

    // Batch of messages
    batch: (count = 10, overrides = {}) => {
      return Array.from({ length: count }, (_, index) => ({
        ...dataGenerators.message.text(),
        id: `msg-${Date.now()}-${index}`,
        content: `Test message ${index + 1}`,
        timestamp: Date.now() - (count - index) * 1000,
        ...overrides,
      }));
    },
  },

  // Space-related data generators
  space: {
    // Basic space
    basic: (overrides = {}) => ({
      id: `space-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Space',
      description: 'A space for testing purposes',
      type: 'public',
      ownerId: 'user-123',
      members: ['user-123', 'user-456', 'user-789'],
      admins: ['user-123'],
      moderators: [],
      channels: [
        { id: 'general', name: 'general', type: 'text', topic: 'General discussion' },
        { id: 'random', name: 'random', type: 'text', topic: 'Random chat' },
      ],
      inviteCode: 'ABC123',
      isPrivate: false,
      maxMembers: 1000,
      settings: {
        allowInvites: true,
        requireApproval: false,
        allowFileUploads: true,
        maxFileSize: 10485760, // 10MB
      },
      createdAt: Date.now() - 86400000, // 1 day ago
      updatedAt: Date.now(),
      ...overrides,
    }),

    // Private space
    private: (overrides = {}) => ({
      ...dataGenerators.space.basic(),
      name: 'Private Test Space',
      type: 'private',
      isPrivate: true,
      inviteCode: null,
      settings: {
        ...dataGenerators.space.basic().settings,
        requireApproval: true,
      },
      ...overrides,
    }),

    // Space with many members
    large: (memberCount = 100, overrides = {}) => ({
      ...dataGenerators.space.basic(),
      name: 'Large Test Space',
      members: Array.from({ length: memberCount }, (_, i) => `user-${i}`),
      ...overrides,
    }),
  },

  // User-related data generators
  user: {
    // Basic user
    basic: (overrides = {}) => ({
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      avatar: null,
      status: 'online',
      lastSeen: Date.now(),
      publicKey: 'mock-public-key-' + Math.random().toString(36).substr(2, 9),
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: true,
        sounds: true,
      },
      createdAt: Date.now() - 2592000000, // 30 days ago
      updatedAt: Date.now(),
      ...overrides,
    }),

    // Admin user
    admin: (overrides = {}) => ({
      ...dataGenerators.user.basic(),
      username: 'admin',
      displayName: 'Admin User',
      roles: ['admin'],
      permissions: ['manage_spaces', 'manage_users', 'moderate_content'],
      ...overrides,
    }),

    // Offline user
    offline: (overrides = {}) => ({
      ...dataGenerators.user.basic(),
      status: 'offline',
      lastSeen: Date.now() - 3600000, // 1 hour ago
      ...overrides,
    }),

    // Batch of users
    batch: (count = 10, overrides = {}) => {
      return Array.from({ length: count }, (_, index) => ({
        ...dataGenerators.user.basic(),
        id: `user-${index}`,
        username: `testuser${index}`,
        displayName: `Test User ${index}`,
        ...overrides,
      }));
    },
  },

  // Configuration data generators
  config: {
    // Default configuration
    default: (overrides = {}) => ({
      version: '1.0.0',
      theme: 'light',
      language: 'en',
      notifications: {
        enabled: true,
        desktop: true,
        sound: true,
        mentions: true,
        directMessages: true,
      },
      privacy: {
        showOnlineStatus: true,
        showLastSeen: true,
        allowDirectMessages: true,
      },
      security: {
        twoFactorEnabled: false,
        sessionTimeout: 86400000, // 24 hours
      },
      sync: {
        enabled: true,
        interval: 30000, // 30 seconds
        batchSize: 100,
      },
      encryption: {
        enabled: true,
        algorithm: 'RSA-OAEP',
        keyLength: 2048,
      },
      performance: {
        messageLoadLimit: 50,
        imageCompressionQuality: 0.8,
        enableVirtualScrolling: true,
      },
      ...overrides,
    }),

    // Privacy-focused configuration
    private: (overrides = {}) => ({
      ...dataGenerators.config.default(),
      notifications: {
        ...dataGenerators.config.default().notifications,
        desktop: false,
        sound: false,
      },
      privacy: {
        showOnlineStatus: false,
        showLastSeen: false,
        allowDirectMessages: false,
      },
      ...overrides,
    }),
  },

  // Encryption-related data generators
  encryption: {
    // Key pair data
    keyPair: (overrides = {}) => ({
      id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      algorithm: 'RSA-OAEP',
      keyLength: 2048,
      publicKey: 'mock-public-key-' + Math.random().toString(36).substr(2, 9),
      privateKey: 'mock-private-key-' + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      expiresAt: Date.now() + 31536000000, // 1 year from now
      isActive: true,
      ...overrides,
    }),

    // Encrypted data
    encryptedData: (originalData: string, overrides = {}) => ({
      id: `enc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      algorithm: 'RSA-OAEP',
      keyId: 'key-123',
      iv: new ArrayBuffer(16),
      encryptedContent: new ArrayBuffer(256),
      originalLength: originalData.length,
      checksum: 'mock-checksum',
      createdAt: Date.now(),
      ...overrides,
    }),
  },

  // Sync-related data generators
  sync: {
    // Sync operation
    operation: (overrides = {}) => ({
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'message',
      action: 'create',
      entityId: 'msg-123',
      spaceId: 'space-456',
      timestamp: Date.now(),
      status: 'pending',
      retries: 0,
      data: {},
      ...overrides,
    }),

    // Sync conflict
    conflict: (overrides = {}) => ({
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityType: 'message',
      entityId: 'msg-123',
      spaceId: 'space-456',
      localVersion: 1,
      remoteVersion: 2,
      localData: { content: 'Local version' },
      remoteData: { content: 'Remote version' },
      timestamp: Date.now(),
      resolved: false,
      resolution: null,
      ...overrides,
    }),

    // Batch sync result
    batchResult: (itemCount = 10, overrides = {}) => ({
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      totalItems: itemCount,
      processedItems: itemCount,
      successfulItems: itemCount - 1,
      failedItems: 1,
      conflicts: 0,
      operations: Array.from({ length: itemCount }, (_, i) =>
        dataGenerators.sync.operation({ id: `sync-op-${i}` })
      ),
      ...overrides,
    }),
  },
};

// Helper function to create realistic test scenarios
export const scenarios = {
  // A complete conversation scenario
  conversation: (messageCount = 10) => {
    const space = dataGenerators.space.basic();
    const users = dataGenerators.user.batch(3);
    const messages = Array.from({ length: messageCount }, (_, index) => {
      const sender = users[index % users.length];
      return dataGenerators.message.text({
        id: `msg-${index}`,
        senderId: sender.id,
        senderName: sender.displayName,
        spaceId: space.id,
        content: `Message ${index + 1} from ${sender.displayName}`,
        timestamp: Date.now() - (messageCount - index) * 60000, // 1 minute apart
      });
    });

    return { space, users, messages };
  },

  // An encrypted space scenario
  encryptedSpace: () => {
    const space = dataGenerators.space.private({ name: 'Secret Space' });
    const users = dataGenerators.user.batch(2);
    const keyPair = dataGenerators.encryption.keyPair();
    const messages = [
      dataGenerators.message.encrypted({
        spaceId: space.id,
        senderId: users[0].id,
        content: '[Encrypted Message 1]',
        encryptionKeyId: keyPair.id,
      }),
      dataGenerators.message.encrypted({
        spaceId: space.id,
        senderId: users[1].id,
        content: '[Encrypted Message 2]',
        encryptionKeyId: keyPair.id,
      }),
    ];

    return { space, users, keyPair, messages };
  },

  // A sync conflict scenario
  syncConflict: () => {
    const message = dataGenerators.message.text();
    const conflict = dataGenerators.sync.conflict({
      entityId: message.id,
      localData: { ...message, content: 'Local edit' },
      remoteData: { ...message, content: 'Remote edit' },
    });

    return { message, conflict };
  },
};