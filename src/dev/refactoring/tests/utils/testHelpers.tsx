// @ts-ignore - Will be available after installing testing library
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// @ts-ignore - Will be available after installing vitest
import { vi, expect } from 'vitest';

// Create a test query client
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

// Test wrapper component
interface TestWrapperProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

const TestWrapper = ({ children, queryClient }: TestWrapperProps) => {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
};

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: queryClient || createTestQueryClient(),
  };
};

// Mock data generators
export const mockDataGenerators = {
  // Generate mock message data
  createMockMessage: (overrides = {}) => ({
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    content: 'Test message content',
    senderId: 'user-123',
    spaceId: 'space-456',
    timestamp: Date.now(),
    encrypted: false,
    type: 'text',
    reactions: [],
    attachments: [],
    ...overrides,
  }),

  // Generate mock space data
  createMockSpace: (overrides = {}) => ({
    id: `space-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Space',
    description: 'A test space for testing',
    ownerId: 'user-123',
    members: ['user-123', 'user-456'],
    channels: ['general'],
    isPrivate: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  // Generate mock user data
  createMockUser: (overrides = {}) => ({
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    username: 'testuser',
    displayName: 'Test User',
    avatar: null,
    publicKey: 'mock-public-key',
    isOnline: true,
    lastSeen: Date.now(),
    ...overrides,
  }),

  // Generate mock config data
  createMockConfig: (overrides = {}) => ({
    theme: 'light',
    language: 'en',
    notifications: {
      enabled: true,
      sound: true,
      desktop: true,
    },
    encryption: {
      enabled: true,
      algorithm: 'RSA-OAEP',
    },
    sync: {
      enabled: true,
      interval: 30000,
    },
    ...overrides,
  }),
};

// Test utilities
export const testUtils = {
  // Wait for async operations
  waitFor: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },

  // Simulate user action delay
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock function factory
  createMockFunction: <T extends (...args: any[]) => any,>(implementation?: T) => {
    return vi.fn(implementation);
  },

  // Mock promise factory
  createMockPromise: <T,>(value?: T, shouldReject = false) => {
    return shouldReject ? Promise.reject(value) : Promise.resolve(value);
  },
};

// Common test assertions
export const testAssertions = {
  // Assert that a function was called with specific arguments
  expectCalledWith: (mockFn: any, ...args: any[]) => {
    expect(mockFn).toHaveBeenCalledWith(...args);
  },

  // Assert that a function was called a specific number of times
  expectCalledTimes: (mockFn: any, times: number) => {
    expect(mockFn).toHaveBeenCalledTimes(times);
  },

  // Assert that an element contains text
  expectElementToContainText: (element: HTMLElement, text: string) => {
    expect(element).toHaveTextContent(text);
  },

  // Assert that an async operation resolves
  expectToResolve: async (promise: Promise<any>) => {
    await expect(promise).resolves.toBeDefined();
  },

  // Assert that an async operation rejects
  expectToReject: async (promise: Promise<any>) => {
    await expect(promise).rejects.toBeDefined();
  },
};