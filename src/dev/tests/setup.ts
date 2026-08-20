// @ts-ignore - Will be available after installing vitest
import '@testing-library/jest-dom';
import { vi } from 'vitest';
// @ts-ignore - Will be available after installing testing library
import { cleanup } from '@testing-library/react';

// Cleanup after each test case (React Testing Library)
afterEach(() => {
  cleanup();
});

// Mock WebSocket for tests
const mockWebSocket = vi.fn(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Setup global mocks
beforeAll(() => {
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
      randomUUID: vi.fn(() => 'mock-uuid-1234-5678-9abc-def012345678'),
      subtle: {
        generateKey: vi.fn(),
        exportKey: vi.fn(),
        importKey: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        // ⚠️ Returns 32 ZERO BYTES for EVERY input, so any code that hashes
        // here produces the same digest for all content. Every "recompute the
        // fingerprint and compare the messageId" check thus compares a constant
        // to a constant and cannot fail. That silently made nine signature-auth
        // tests pass while verifying nothing (2026-08-20), and the inline
        // verify blocks in MessageService.handleNewMessage still hash this way,
        // so they remain untestable through this setup. If you are testing
        // anything signature-related, either drive code that uses the shared
        // primitive (noble SHA-256, not stubbed) or replace this stub locally.
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    },
    configurable: true,
    writable: true,
  });
});

afterAll(() => {
  vi.clearAllMocks();
});
