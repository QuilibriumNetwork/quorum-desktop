/**
 * MOBILE SDK SHIM - TEMPORARY IMPLEMENTATION
 * ==========================================
 * 
 * This is a mock implementation of the Quilibrium SDK for React Native.
 * The actual SDK has Node.js and WebAssembly dependencies that are incompatible
 * with React Native's runtime environment.
 * 
 * TODO: When implementing real SDK integration:
 * 1. Replace this entire file with actual React Native compatible SDK
 * 2. Consider using one of these approaches:
 *    - Server-side proxy for passkey operations
 *    - Native modules for iOS/Android passkey APIs
 *    - Modified SDK build without Node.js/WASM dependencies
 * 
 * IMPORTANT: All methods currently return mock data or no-ops.
 * Passkey functionality is NOT available on mobile until properly implemented.
 * 
 * See: .readme/tasks/todo/mobile-sdk-integration-issue.md for full details
 */

import React, { createContext, useContext, ReactNode, useState } from 'react';

// ============================================================================
// TYPE DEFINITIONS - Must match the real SDK interface
// ============================================================================

export interface UserKeyset {
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface DeviceKeyset {
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface UserRegistration {
  username: string;
  address: string;
  publicKey?: string;
  // Add other fields as needed
}

export interface PasskeyInfo {
  credentialId: string;
  address: string;
  publicKey?: string;
}

export interface StoredPasskey {
  credentialId: string;
  address: string;
  publicKey: string;
  displayName?: string;
  pfpUrl?: string;
  completedOnboarding?: boolean;
}

export interface PasskeysContextType {
  address: string | null;
  username: string | null;
  publicKey: string | null;
  credentialId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentPasskeyInfo: PasskeyInfo | null;
  
  // Methods that need to be mocked
  login: () => Promise<void>;
  logout: () => void;
  register: (username: string) => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateStoredPasskey: (credentialId: string, updates: Partial<StoredPasskey>) => void;
  exportKey?: (address: string) => Promise<string>;
}

// ============================================================================
// CHANNEL_RAW MOCK - Basic channel operations without encryption
// ============================================================================

export const channel_raw = {
  /**
   * TODO: Implement actual message validation
   * Currently returns true for all inputs
   */
  validateMessage: (message: any): boolean => {
    console.warn('[SDK Mock] validateMessage called - returning true');
    return true;
  },

  /**
   * TODO: Implement actual signature verification
   * Currently returns true for all inputs
   */
  verifySignature: (message: any, signature: any, publicKey: any): boolean => {
    console.warn('[SDK Mock] verifySignature called - returning true');
    return true;
  },

  /**
   * TODO: Implement actual message parsing
   * Currently returns the input as-is
   */
  parseMessage: (message: any): any => {
    console.warn('[SDK Mock] parseMessage called - returning input');
    return message;
  },

  /**
   * TODO: Implement actual key generation
   * Currently returns mock keys
   */
  generateKeyset: (): { privateKey: string; publicKey: string; address: string } => {
    console.warn('[SDK Mock] generateKeyset called - returning mock keys');
    return {
      privateKey: 'mock_private_key',
      publicKey: 'mock_public_key',
      address: 'mock_address_' + Math.random().toString(36).substr(2, 9),
    };
  },
};

// ============================================================================
// CHANNEL MOCK - Secure channel operations with encryption
// ============================================================================

export const channel = {
  /**
   * TODO: Implement actual user registration upload
   * This should interact with the backend API
   */
  uploadUserRegistration: async (registration: any): Promise<void> => {
    console.warn('[SDK Mock] uploadUserRegistration called - no-op');
    // In real implementation, this would:
    // 1. Validate the registration data
    // 2. Sign it with the user's private key
    // 3. Upload to the backend
    return Promise.resolve();
  },

  /**
   * TODO: Implement actual user lookup
   * Should query the backend for user information
   */
  lookupUser: async (address: string): Promise<UserRegistration | null> => {
    console.warn(`[SDK Mock] lookupUser called for ${address} - returning null`);
    // In real implementation, this would:
    // 1. Query the backend API for user with given address
    // 2. Verify the response signature
    // 3. Return the user data
    return Promise.resolve(null);
  },

  /**
   * TODO: Implement actual message encryption
   * Should use proper E2E encryption
   */
  encryptMessage: (message: any, recipientPublicKey: string): any => {
    console.warn('[SDK Mock] encryptMessage called - returning mock encrypted data');
    return {
      encrypted: true,
      data: message,
      recipientKey: recipientPublicKey,
    };
  },

  /**
   * TODO: Implement actual message decryption
   * Should decrypt E2E encrypted messages
   */
  decryptMessage: (encryptedMessage: any, privateKey: string): any => {
    console.warn('[SDK Mock] decryptMessage called - returning mock decrypted data');
    return encryptedMessage.data || encryptedMessage;
  },

  /**
   * TODO: Implement actual message signing
   * Should sign messages with private key
   */
  signMessage: (message: any, privateKey: string): string => {
    console.warn('[SDK Mock] signMessage called - returning mock signature');
    return 'mock_signature_' + Math.random().toString(36).substr(2, 9);
  },

  // Re-export UserKeyset and DeviceKeyset types
  UserKeyset: {} as any,
  DeviceKeyset: {} as any,
  UserRegistration: {} as any,
};

// ============================================================================
// PASSKEYS CONTEXT MOCK
// ============================================================================

const PasskeysContext = createContext<PasskeysContextType | null>(null);

/**
 * TODO: Implement actual passkey provider for React Native
 * This should handle:
 * - Secure storage of keys (using Keychain/Keystore)
 * - Biometric authentication
 * - Session management
 */
export const PasskeysProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // TODO: Replace with actual state management
  // Mock passkey info for testing mobile onboarding - using state for updates
  const [mockPasskeyInfo, setMockPasskeyInfo] = useState<PasskeyInfo & Partial<StoredPasskey>>({
    credentialId: 'mock_credential_id_12345',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    publicKey: 'mock_public_key_abcdef123456',
    displayName: undefined,
    pfpUrl: undefined,
    completedOnboarding: false,
  });

  const mockValue: PasskeysContextType = {
    address: mockPasskeyInfo.address,
    username: mockPasskeyInfo.displayName || 'MockUser',
    publicKey: mockPasskeyInfo.publicKey,
    credentialId: mockPasskeyInfo.credentialId,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    currentPasskeyInfo: mockPasskeyInfo,
    
    login: async () => {
      console.warn('[SDK Mock] Passkey login not available on mobile');
      throw new Error('Passkey authentication not available on mobile');
    },
    
    logout: () => {
      console.warn('[SDK Mock] Logout called - no-op');
    },
    
    register: async (username: string) => {
      console.warn(`[SDK Mock] Register called for ${username} - not available`);
      throw new Error('Passkey registration not available on mobile');
    },
    
    updateProfile: async (data: any) => {
      console.warn('[SDK Mock] updateProfile called - no-op');
    },
    
    deleteAccount: async () => {
      console.warn('[SDK Mock] deleteAccount called - not available');
      throw new Error('Account deletion not available on mobile');
    },

    // Add updateStoredPasskey method for onboarding flow
    updateStoredPasskey: (credentialId: string, updates: Partial<StoredPasskey>) => {
      console.warn('[SDK Mock] updateStoredPasskey called with:', updates);
      setMockPasskeyInfo(prev => ({
        ...prev,
        ...updates,
      }));
    },

    // Add exportKey method for key backup functionality
    exportKey: async (address: string): Promise<string> => {
      console.warn('[SDK Mock] exportKey called - returning mock key data');
      return JSON.stringify({
        address: address,
        privateKey: 'mock_private_key_data_for_testing',
        createdAt: new Date().toISOString(),
        version: '1.0',
        isMockData: true,
      });
    },
  };

  return (
    <PasskeysContext.Provider value={mockValue}>
      {children}
    </PasskeysContext.Provider>
  );
};

/**
 * Hook to use passkeys context
 * TODO: When implementing real SDK, ensure this returns actual auth state
 */
export const usePasskeysContext = (): PasskeysContextType => {
  const context = useContext(PasskeysContext);
  if (!context) {
    // Return a default mock context to prevent crashes
    // TODO: In production, this should properly handle missing provider
    console.warn('[SDK Mock] usePasskeysContext called outside provider - returning mock');
    return {
      address: null,
      username: null,
      publicKey: null,
      credentialId: null,
      isAuthenticated: false,
      isLoading: false,
      error: 'Passkeys not available on mobile',
      currentPasskeyInfo: null,
      login: async () => { throw new Error('Not available'); },
      logout: () => {},
      register: async () => { throw new Error('Not available'); },
      updateProfile: async () => {},
      deleteAccount: async () => { throw new Error('Not available'); },
      updateStoredPasskey: () => { console.warn('[SDK Mock] updateStoredPasskey - no provider'); },
    };
  }
  return context;
};

// ============================================================================
// PASSKEY NAMESPACE EXPORT
// ============================================================================

export const passkey = {
  StoredPasskey: {} as StoredPasskey, // Type export for compatibility
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  channel,
  channel_raw,
  passkey,
  PasskeysProvider,
  usePasskeysContext,
};

/**
 * IMPLEMENTATION NOTES FOR REAL SDK:
 * ===================================
 * 
 * 1. Crypto Operations:
 *    - Use react-native-crypto or expo-crypto for cryptographic operations
 *    - Consider using SubtleCrypto polyfill for React Native
 * 
 * 2. Key Storage:
 *    - iOS: Use Keychain Services
 *    - Android: Use Android Keystore
 *    - Consider expo-secure-store for simpler implementation
 * 
 * 3. WebAssembly Replacement:
 *    - Port WASM functionality to pure JavaScript
 *    - Or use native modules for performance-critical operations
 * 
 * 4. Biometric Authentication:
 *    - Use expo-local-authentication or react-native-biometrics
 *    - Tie passkey operations to biometric verification
 * 
 * 5. Network Communication:
 *    - Ensure all API calls work with React Native's fetch
 *    - Handle offline scenarios appropriately
 * 
 * 6. Testing:
 *    - Create comprehensive tests for all mocked methods
 *    - Ensure feature parity with web implementation
 */