import React, { createContext, useContext, ReactNode } from 'react';
import { vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// Mock MessageDB Context with expected behavior patterns
// This simulates the real MessageDB context but with controlled, testable behavior

type MockMessageDBContextValue = {
  messageDB: any;
  keyset: {
    userKeyset: any;
    deviceKeyset: any;
  };
  setKeyset: any;
  deleteEncryptionStates: (args: { conversationId: string }) => Promise<void>;
  submitMessage: (
    address: string,
    pendingMessage: string | object,
    self: any,
    counterparty: any,
    queryClient: QueryClient,
    currentPasskeyInfo: any,
    keyset: any,
    inReplyTo?: string
  ) => Promise<void>;
  createSpace: (
    spaceName: string,
    spaceIcon: string,
    keyset: any,
    registration: any,
    isRepudiable: boolean,
    isPublic: boolean,
    userIcon: string,
    userDisplayName: string
  ) => Promise<{ spaceId: string; channelId: string }>;
  updateSpace: (space: any) => Promise<void>;
  createChannel: (spaceId: string) => Promise<string>;
  submitChannelMessage: (
    spaceId: string,
    channelId: string,
    pendingMessage: string | object,
    queryClient: QueryClient,
    currentPasskeyInfo: any,
    inReplyTo?: string,
    skipSigning?: boolean
  ) => Promise<void>;
  getConfig: (args: { address: string; userKey: any }) => Promise<any>;
  saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  setSelfAddress: any;
  ensureKeyForSpace: (user_address: string, space: any) => Promise<string>;
  sendInviteToUser: (
    address: string,
    spaceId: string,
    currentPasskeyInfo: any
  ) => Promise<void>;
  generateNewInviteLink: (
    spaceId: string,
    user_keyset: any,
    device_keyset: any,
    registration: any
  ) => Promise<void>;
  processInviteLink: (inviteLink: string) => Promise<any>;
  joinInviteLink: (
    inviteLink: string,
    keyset: any,
    currentPasskeyInfo: any
  ) => Promise<{ spaceId: string; channelId: string } | undefined>;
  deleteSpace: (spaceId: string) => Promise<void>;
  kickUser: (
    spaceId: string,
    userAddress: string,
    user_keyset: any,
    device_keyset: any,
    registration: any
  ) => Promise<void>;
  updateUserProfile: (
    displayName: string,
    userIcon: string,
    currentPasskeyInfo: any
  ) => Promise<void>;
  requestSync: (spaceId: string) => Promise<void>;
  sendVerifyKickedStatuses: (spaceId: string) => Promise<number>;
  deleteConversation: (
    conversationId: string,
    currentPasskeyInfo: any
  ) => Promise<void>;
};

const MockMessageDBContext = createContext<MockMessageDBContextValue | null>(null);

export const useMockMessageDB = () => {
  const context = useContext(MockMessageDBContext);
  if (!context) {
    throw new Error('useMockMessageDB must be used within MockMessageDBProvider');
  }
  return context;
};

// Mock implementations that simulate expected behavior patterns
export const createMockMessageDBValue = (): MockMessageDBContextValue => {
  const mockMessageDB = {
    saveMessage: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    getConversation: vi.fn().mockResolvedValue(null),
    updateMessage: vi.fn().mockResolvedValue(undefined),
  };

  return {
    messageDB: mockMessageDB,
    keyset: {
      userKeyset: {
        privateKey: 'mock-user-private',
        publicKey: 'mock-user-public',
      },
      deviceKeyset: {
        privateKey: 'mock-device-private',
        publicKey: 'mock-device-public',
      },
    },
    setKeyset: vi.fn(),
    setSelfAddress: vi.fn(),

    // CRITICAL FUNCTION 1: submitMessage
    submitMessage: vi.fn().mockImplementation(async (
      address: string,
      pendingMessage: string | object,
      self: any,
      counterparty: any,
      queryClient: QueryClient,
      currentPasskeyInfo: any,
      keyset: any,
      inReplyTo?: string
    ) => {
      // Simulate expected behavior pattern:
      // 1. Message encryption
      console.log('Mock: Encrypting message');

      // 2. Database storage
      await mockMessageDB.saveMessage({
        id: `msg-${Date.now()}`,
        content: typeof pendingMessage === 'string' ? pendingMessage : JSON.stringify(pendingMessage),
        senderId: self.address,
        recipientId: counterparty.address,
        timestamp: new Date(),
        encrypted: true,
        replyTo: inReplyTo,
      });

      // 3. Cache update (simulate React Query cache update)
      const cacheKey = ['messages', `${self.address}_${counterparty.address}`];
      const existingData = queryClient.getQueryData(cacheKey) || [];
      queryClient.setQueryData(cacheKey, [...existingData, { id: `msg-${Date.now()}` }]);

      // 4. WebSocket send (would be mocked)
      console.log('Mock: Sending via WebSocket');

      return Promise.resolve();
    }),

    // CRITICAL FUNCTION 2: createSpace
    createSpace: vi.fn().mockImplementation(async (
      spaceName: string,
      spaceIcon: string,
      keyset: any,
      registration: any,
      isRepudiable: boolean,
      isPublic: boolean,
      userIcon: string,
      userDisplayName: string
    ) => {
      // Simulate expected behavior pattern:
      // 1. Space registration with API
      console.log('Mock: Creating space registration');

      // 2. Generate encryption keys for private spaces
      if (!isPublic) {
        console.log('Mock: Generating encryption keys');
      }

      // 3. Create default channels
      const spaceId = `space-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const channelId = `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 4. Set creator as owner/admin
      // 5. Store in database
      // 6. Update cache

      return { spaceId, channelId };
    }),

    // CRITICAL FUNCTION 3: joinInviteLink
    joinInviteLink: vi.fn().mockImplementation(async (
      inviteLink: string,
      keyset: any,
      currentPasskeyInfo: any
    ) => {
      // Simulate expected behavior pattern:
      // 1. Validate invite
      if (!inviteLink.includes('invite/')) {
        return undefined; // Invalid invite
      }

      // 2. Handle key exchange
      console.log('Mock: Performing key exchange');

      // 3. Add user to space
      const spaceId = `space-joined-${Date.now()}`;
      const channelId = `channel-general-${Date.now()}`;

      return { spaceId, channelId };
    }),

    // CRITICAL FUNCTION 4: requestSync
    requestSync: vi.fn().mockImplementation(async (spaceId: string) => {
      // Simulate expected behavior pattern:
      // 1. Conflict resolution
      console.log('Mock: Resolving conflicts');

      // 2. Data integrity checks
      console.log('Mock: Checking data integrity');

      // 3. Incremental sync logic
      console.log('Mock: Performing incremental sync');

      return Promise.resolve();
    }),

    // CRITICAL FUNCTION 5: generateNewInviteLink
    generateNewInviteLink: vi.fn().mockImplementation(async (
      spaceId: string,
      user_keyset: any,
      device_keyset: any,
      registration: any
    ) => {
      // Simulate expected behavior pattern:
      // 1. Generate cryptographic token
      console.log('Mock: Generating crypto token');

      // 2. Set expiration and limits
      console.log('Mock: Setting expiration');

      // 3. Encrypt invite data for private spaces
      console.log('Mock: Encrypting invite data');

      return Promise.resolve();
    }),

    // CRITICAL FUNCTION 6: processInviteLink
    processInviteLink: vi.fn().mockImplementation(async (inviteLink: string) => {
      // Simulate expected behavior pattern:
      // 1. Validate token authenticity
      if (!inviteLink.includes('invite/')) {
        throw new Error('Invalid invite link');
      }

      // 2. Check expiration and usage limits
      console.log('Mock: Checking expiration');

      // 3. Decrypt invite data
      console.log('Mock: Decrypting invite data');

      // 4. Return space information
      return {
        id: 'space-from-invite',
        name: 'Test Space',
        description: 'A space from invite',
        memberCount: 42,
      };
    }),

    // CRITICAL FUNCTION 7: handleNewMessage (simulated through submitChannelMessage)
    submitChannelMessage: vi.fn().mockImplementation(async (
      spaceId: string,
      channelId: string,
      pendingMessage: string | object,
      queryClient: QueryClient,
      currentPasskeyInfo: any,
      inReplyTo?: string,
      skipSigning?: boolean
    ) => {
      // Simulate expected behavior pattern for channel messages:
      // 1. Validate permissions
      console.log('Mock: Validating channel permissions');

      // 2. Encrypt message
      console.log('Mock: Encrypting channel message');

      // 3. Store in database
      // 4. Update cache
      // 5. Broadcast to space members

      return Promise.resolve();
    }),

    // Other functions with basic mock implementations
    updateSpace: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue(`channel-${Date.now()}`),
    getConfig: vi.fn().mockResolvedValue({ theme: 'light' }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    ensureKeyForSpace: vi.fn().mockResolvedValue(`key-${Date.now()}`),
    sendInviteToUser: vi.fn().mockResolvedValue(undefined),
    deleteSpace: vi.fn().mockResolvedValue(undefined),
    kickUser: vi.fn().mockResolvedValue(undefined),
    updateUserProfile: vi.fn().mockResolvedValue(undefined),
    sendVerifyKickedStatuses: vi.fn().mockResolvedValue(5),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
    deleteEncryptionStates: vi.fn().mockResolvedValue(undefined),
  };
};

export const MockMessageDBProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const mockValue = createMockMessageDBValue();

  return (
    <MockMessageDBContext.Provider value={mockValue}>
      {children}
    </MockMessageDBContext.Provider>
  );
};

// Test helper to get access to the mock functions for verification
export const getMockMessageDBFunctions = (mockValue: MockMessageDBContextValue) => ({
  submitMessage: mockValue.submitMessage,
  createSpace: mockValue.createSpace,
  joinInviteLink: mockValue.joinInviteLink,
  requestSync: mockValue.requestSync,
  generateNewInviteLink: mockValue.generateNewInviteLink,
  processInviteLink: mockValue.processInviteLink,
  submitChannelMessage: mockValue.submitChannelMessage,
  messageDB: mockValue.messageDB,
});