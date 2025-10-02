# Task: Implement True Integration Tests for MessageDB Services

**Status**: To Do
**Priority**: High
**Complexity**: Medium

## 1. Problem Statement

Following the major refactoring of `MessageDB.tsx` into multiple services, our current test suite is insufficient. The tests primarily validate mocks and function signatures but do not verify that the new services are correctly wired together.

Manual testing has confirmed basic functionality, but it is not repeatable, precise, or scalable. A suite of true integration tests is required to create a permanent safety net, prevent future regressions, and build long-term confidence in the new architecture.

## 2. Objective

Create a suite of integration tests that validate the end-to-end behavior of the critical functions exposed by `MessageDBProvider`. These tests should treat the provider as a black box, calling its functions and asserting that the expected side effects (database writes, network calls, cache updates) occur correctly.

---

## 3. Test Implementation Blueprint

This blueprint outlines a reusable pattern for creating the new tests. The core idea is to **render the actual `MessageDBProvider`** in a controlled environment and mock the boundaries of the system (API, DB, WebSockets).

### Phase 1: Create a Reusable Test Wrapper

The first step is to create a single, reusable test wrapper component. This component will provide the necessary context for the `MessageDBProvider` to render successfully in a test environment.

**File:** `src/dev/tests/utils/TestWrapper.tsx`

```tsx
import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuorumApiProvider } from '../../components/context/QuorumApiContext'; // Assuming a mockable provider
import { WebSocketProvider } from '../../components/context/WebsocketProvider';   // Assuming a mockable provider
import { mockApiClient } from '../mocks/api.mock'; // Create a mock API client
import { mockWebSocket } from '../mocks/webSocket.mock'; // Use existing WebSocket mock

// Create a new query client for each test to ensure isolation
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export const TestWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {/* These providers will need to be adapted to accept mock clients/values */}
      <QuorumApiProvider client={mockApiClient}>
        <WebSocketProvider client={mockWebSocket}>
          {children}
        </WebSocketProvider>
      </QuorumApiProvider>
    </QueryClientProvider>
  );
};
```

### Phase 2: The First Test Blueprint (Example: `submitMessage`)

Create a new test file, e.g., `src/dev/tests/messagedb/MessageDB.integration.test.tsx`. The first test will serve as the pattern for all others.

```tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { MessageDBProvider, useMessageDB } from '../../components/context/MessageDB';
import { TestWrapper } from '../utils/TestWrapper';
import { mockIndexedDB } from '../mocks/indexedDB.mock';
import { mockWebSocket } from '../mocks/webSocket.mock';
import { generateMockUser, generateMockMessageData } from '../utils/dataGenerators';

describe('MessageDB Integration Tests', () => {

  beforeEach(() => {
    // Reset all mocks before each test to ensure a clean state
    vi.clearAllMocks();
    mockIndexedDB.clear(); // Add a clear method to your mock DB
  });

  it('should handle submitMessage end-to-end', async () => {
    // 1. ARRANGE: Render the real provider within our test wrapper
    const { result } = renderHook(() => useMessageDB(), {
      wrapper: ({ children }) => (
        <TestWrapper>
          <MessageDBProvider>{children}</MessageDBProvider>
        </TestWrapper>
      ),
    });

    const { submitMessage } = result.current;
    const { mockMessage, mockSelf, mockCounterparty, mockPasskeyInfo } = generateMockMessageData();

    // 2. ACT: Call the function from the hook
    await act(async () => {
      await submitMessage(
        mockCounterparty.address,
        mockMessage,
        mockSelf,
        mockCounterparty,
        // queryClient is now managed by the TestWrapper
        // ... other params
      );
    });

    // 3. ASSERT: Check the side effects at the boundaries
    await waitFor(() => {
      // Assert 1: Database
      // You'll need to add a method to your mock to get data
      const dbRecord = mockIndexedDB.getStore('messages').get(mockMessage.id);
      expect(dbRecord).toBeDefined();
      expect(dbRecord.content).toEqual(/* some encrypted state */);

      // Assert 2: Network
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining(mockMessage.content)
      );

      // Assert 3: UI State (React Query Cache)
      // This requires getting the queryClient from the wrapper
      const queryCache = queryClient.getQueryCache();
      const conversationQuery = queryCache.find(['conversations', 'direct']);
      expect(conversationQuery.state.data).toBeDefined();
      // ... more detailed cache assertions
    });
  });
});
```

### Phase 3: Scale the Blueprint

Apply the `Arrange-Act-Assert` pattern from Phase 2 to other critical functions. The setup will be nearly identical for each test.

**Target Functions:**
- `createSpace`
- `joinInviteLink`
- `requestSync`
- `handleNewMessage` (more complex, but can be tested by simulating a message from the mock WebSocket)
- `deleteConversation`

## 4. Success Criteria

- A reusable `<TestWrapper>` component is created that can render the `MessageDBProvider` for testing.
- At least 5-7 of the most critical `MessageDB` functions are covered by new integration tests following the blueprint.
- The tests reliably pass and fail appropriately, catching integration-level bugs between services.
- The new test suite is added to the project's CI/CD pipeline.
