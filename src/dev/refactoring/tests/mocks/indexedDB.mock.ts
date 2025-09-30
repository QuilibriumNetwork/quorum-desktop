// @ts-ignore - Will be available after installing vitest
import { vi } from 'vitest';

// Mock IndexedDB implementation for testing
export const createMockIndexedDB = () => {
  const mockDatabase = new Map();
  const mockStores = new Map();

  const mockObjectStore = {
    add: vi.fn().mockImplementation((value, key) => {
      const actualKey = key || value.id || Math.random().toString();
      mockStores.set(actualKey, value);
      return Promise.resolve(actualKey);
    }),
    put: vi.fn().mockImplementation((value, key) => {
      const actualKey = key || value.id || Math.random().toString();
      mockStores.set(actualKey, value);
      return Promise.resolve(actualKey);
    }),
    get: vi.fn().mockImplementation((key) => {
      return Promise.resolve(mockStores.get(key));
    }),
    getAll: vi.fn().mockImplementation(() => {
      return Promise.resolve(Array.from(mockStores.values()));
    }),
    delete: vi.fn().mockImplementation((key) => {
      const deleted = mockStores.delete(key);
      return Promise.resolve(deleted);
    }),
    clear: vi.fn().mockImplementation(() => {
      mockStores.clear();
      return Promise.resolve();
    }),
    index: vi.fn().mockReturnValue({
      get: vi.fn(),
      getAll: vi.fn(),
    }),
    createIndex: vi.fn(),
  };

  const mockTransaction = {
    objectStore: vi.fn().mockReturnValue(mockObjectStore),
    complete: Promise.resolve(),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const mockDB = {
    createObjectStore: vi.fn().mockReturnValue(mockObjectStore),
    deleteObjectStore: vi.fn(),
    transaction: vi.fn().mockReturnValue(mockTransaction),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const mockRequest = {
    result: mockDB,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const mockIndexedDB = {
    open: vi.fn().mockReturnValue(mockRequest),
    deleteDatabase: vi.fn().mockReturnValue(mockRequest),
    cmp: vi.fn(),
  };

  return {
    mockIndexedDB,
    mockDB,
    mockTransaction,
    mockObjectStore,
    mockRequest,
    mockDatabase,
    mockStores,
  };
};

// Helper to reset all mocks
export const resetIndexedDBMocks = (mocks: ReturnType<typeof createMockIndexedDB>) => {
  mocks.mockStores.clear();
  mocks.mockDatabase.clear();
  Object.values(mocks).forEach(mock => {
    if (typeof mock === 'object' && mock !== null && 'mockClear' in mock) {
      (mock as any).mockClear();
    }
  });
};

// Export the default mock for convenience
export const mockIndexedDB = createMockIndexedDB();