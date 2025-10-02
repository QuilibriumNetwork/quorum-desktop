// @ts-ignore - Will be available after installing vitest
import '@testing-library/jest-dom';
// @ts-ignore - Will be available after installing vitest
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
// @ts-ignore - Will be available after installing testing library
import { cleanup } from '@testing-library/react';

// Cleanup after each test case (React Testing Library)
afterEach(() => {
  cleanup();
});

// Mock IndexedDB for tests
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  cmp: vi.fn(),
};

// Mock WebSocket for tests
const mockWebSocket = vi.fn(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Setup global mocks
beforeAll(() => {
  // Mock IndexedDB
  global.indexedDB = mockIndexedDB as any;
  global.IDBRequest = vi.fn() as any;
  global.IDBObjectStore = vi.fn() as any;
  global.IDBTransaction = vi.fn() as any;
  global.IDBDatabase = vi.fn() as any;

  // Mock WebSocket
  global.WebSocket = mockWebSocket as any;

  // Mock crypto for encryption tests
  // Use Object.defineProperty to override read-only crypto
  Object.defineProperty(global, 'crypto', {
    value: {
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
      subtle: {
        generateKey: vi.fn(),
        exportKey: vi.fn(),
        importKey: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
      },
    },
    configurable: true,
    writable: true,
  });
});

afterAll(() => {
  vi.clearAllMocks();
});