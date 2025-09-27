// @ts-ignore - Will be available after installing vitest
import { vi } from 'vitest';

// Mock encryption utilities for testing
export const createMockEncryption = () => {
  // Mock key pair
  const mockKeyPair = {
    publicKey: {
      algorithm: { name: 'RSA-OAEP' },
      extractable: true,
      type: 'public',
      usages: ['encrypt'],
    },
    privateKey: {
      algorithm: { name: 'RSA-OAEP' },
      extractable: true,
      type: 'private',
      usages: ['decrypt'],
    },
  };

  // Mock encrypted data
  const mockEncryptedData = new ArrayBuffer(256);

  // Mock subtle crypto methods
  const mockSubtleCrypto = {
    generateKey: vi.fn().mockResolvedValue(mockKeyPair),

    exportKey: vi.fn().mockImplementation((format: string, key: CryptoKey) => {
      if (format === 'jwk') {
        return Promise.resolve({
          kty: 'RSA',
          n: 'mock-modulus',
          e: 'AQAB',
          d: key.type === 'private' ? 'mock-private-exponent' : undefined,
        });
      }
      return Promise.resolve(new ArrayBuffer(256));
    }),

    importKey: vi.fn().mockResolvedValue(mockKeyPair.publicKey),

    encrypt: vi.fn().mockImplementation((algorithm: any, key: CryptoKey, data: BufferSource) => {
      // Simulate encryption by returning mock encrypted data
      return Promise.resolve(mockEncryptedData);
    }),

    decrypt: vi.fn().mockImplementation((algorithm: any, key: CryptoKey, data: BufferSource) => {
      // Simulate decryption by returning the "original" data
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      return Promise.resolve(encoder.encode('decrypted-data'));
    }),

    sign: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
    verify: vi.fn().mockResolvedValue(true),
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    deriveKey: vi.fn().mockResolvedValue(mockKeyPair.publicKey),
    wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
    unwrapKey: vi.fn().mockResolvedValue(mockKeyPair.publicKey),
  };

  // Mock getRandomValues
  const mockGetRandomValues = vi.fn().mockImplementation((array: any) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  });

  // Mock crypto object
  const mockCrypto = {
    subtle: mockSubtleCrypto,
    getRandomValues: mockGetRandomValues,
  };

  return {
    mockCrypto,
    mockSubtleCrypto,
    mockGetRandomValues,
    mockKeyPair,
    mockEncryptedData,
  };
};

// Helper functions for encryption testing
export const mockEncryptionHelpers = {
  // Generate mock encrypted message
  createMockEncryptedMessage: (content: string) => ({
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    content,
    encrypted: true,
    encryptedData: new ArrayBuffer(256),
    timestamp: Date.now(),
  }),

  // Generate mock key pair data
  createMockKeyPairData: () => ({
    publicKey: 'mock-public-key-' + Math.random().toString(36).substr(2, 9),
    privateKey: 'mock-private-key-' + Math.random().toString(36).substr(2, 9),
    algorithm: 'RSA-OAEP',
    keyLength: 2048,
  }),

  // Reset all crypto mocks
  resetCryptoMocks: (mocks: ReturnType<typeof createMockEncryption>) => {
    Object.values(mocks.mockSubtleCrypto).forEach(mock => {
      if (typeof mock === 'function' && 'mockClear' in mock) {
        mock.mockClear();
      }
    });
    mocks.mockGetRandomValues.mockClear();
  },
};