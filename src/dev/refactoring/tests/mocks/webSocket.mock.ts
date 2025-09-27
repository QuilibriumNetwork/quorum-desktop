// @ts-ignore - Will be available after installing vitest
import { vi } from 'vitest';

// Mock WebSocket implementation for testing
export const createMockWebSocket = () => {
  const mockEventListeners = new Map();

  const mockWebSocket = {
    readyState: 0 as 0 | 1 | 2 | 3, // WebSocket.CONNECTING
    url: '',
    protocol: '',
    extensions: '',
    bufferedAmount: 0,
    binaryType: 'blob' as BinaryType,

    // Connection methods
    close: vi.fn().mockImplementation((code?: number, reason?: string) => {
      mockWebSocket.readyState = 3; // WebSocket.CLOSED
      const event = new CloseEvent('close', { code, reason });
      mockWebSocket.dispatchEvent('close', event);
    }),

    send: vi.fn().mockImplementation((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (mockWebSocket.readyState !== 1) { // WebSocket.OPEN
        throw new Error('WebSocket is not open');
      }
      // Simulate message being sent
      return true;
    }),

    // Event handling
    addEventListener: vi.fn().mockImplementation((type: string, listener: EventListener) => {
      if (!mockEventListeners.has(type)) {
        mockEventListeners.set(type, []);
      }
      mockEventListeners.get(type).push(listener);
    }),

    removeEventListener: vi.fn().mockImplementation((type: string, listener: EventListener) => {
      if (mockEventListeners.has(type)) {
        const listeners = mockEventListeners.get(type);
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }),

    dispatchEvent: vi.fn().mockImplementation((type: string, event: Event) => {
      if (mockEventListeners.has(type)) {
        mockEventListeners.get(type).forEach((listener: EventListener) => {
          listener(event);
        });
      }

      // Also call direct event handlers
      const handler = (mockWebSocket as any)[`on${type}`];
      if (handler) {
        handler(event);
      }
    }),

    // Event handlers (can be set directly)
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };

  // Helper methods for testing
  const mockHelpers = {
    // Simulate connection opening
    simulateOpen: () => {
      mockWebSocket.readyState = 1; // WebSocket.OPEN
      const event = new Event('open');
      mockWebSocket.dispatchEvent('open', event);
    },

    // Simulate receiving a message
    simulateMessage: (data: any) => {
      const event = new MessageEvent('message', { data });
      mockWebSocket.dispatchEvent('message', event);
    },

    // Simulate connection error
    simulateError: (error?: any) => {
      const event = new ErrorEvent('error', { error });
      mockWebSocket.dispatchEvent('error', event);
    },

    // Simulate connection closing
    simulateClose: (code = 1000, reason = '') => {
      mockWebSocket.readyState = 3; // WebSocket.CLOSED
      const event = new CloseEvent('close', { code, reason });
      mockWebSocket.dispatchEvent('close', event);
    },

    // Reset the mock
    reset: () => {
      mockEventListeners.clear();
      mockWebSocket.readyState = 0; // WebSocket.CONNECTING
      mockWebSocket.onopen = null;
      mockWebSocket.onclose = null;
      mockWebSocket.onmessage = null;
      mockWebSocket.onerror = null;
      Object.values(mockWebSocket).forEach(prop => {
        if (typeof prop === 'function' && 'mockClear' in prop) {
          prop.mockClear();
        }
      });
    }
  };

  return { mockWebSocket, mockHelpers };
};

// Global WebSocket mock constructor
export const MockWebSocketConstructor = vi.fn().mockImplementation((url: string, protocols?: string | string[]) => {
  const { mockWebSocket } = createMockWebSocket();
  mockWebSocket.url = url;
  if (protocols) {
    mockWebSocket.protocol = Array.isArray(protocols) ? protocols[0] : protocols;
  }
  return mockWebSocket;
});