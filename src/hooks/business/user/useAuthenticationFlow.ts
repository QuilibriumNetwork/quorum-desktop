import { useState, useCallback } from 'react';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';
import { DefaultImages } from '../../../utils';

export type AuthMode = 'login' | 'register' | 'import';

export interface AuthUser {
  displayName: string;
  state: string;
  status: string;
  userIcon: string;
  address: string;
}

/**
 * Hook for managing authentication flow and user registration
 * Handles auth state, API integration, and user setup
 * Cross-platform compatible business logic
 */
export const useAuthenticationFlow = () => {
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start new account registration flow
  const startNewAccount = useCallback(() => {
    setAuthMode('register');
    setError(null);
  }, []);

  // Start existing key import flow
  const startImportAccount = useCallback(() => {
    setAuthMode('import');
    setError(null);
  }, []);

  // Reset to initial login state
  const resetAuthFlow = useCallback(() => {
    setAuthMode('login');
    setError(null);
    setIsAuthenticating(false);
  }, []);

  // Handle authentication completion and user setup
  const completeAuthentication = useCallback(
    (passkeyInfo: any, setUser: (user: AuthUser) => void) => {
      try {
        setUser({
          displayName: passkeyInfo.displayName,
          state: 'online',
          status: '',
          userIcon: passkeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER,
          address: passkeyInfo.address,
        });
        setError(null);
      } catch (error) {
        console.error('Error completing authentication:', error);
        setError('Failed to complete authentication');
      }
    },
    []
  );

  // Get user registration data from API
  const getUserRegistration = useCallback(
    async (address: string) => {
      try {
        setIsAuthenticating(true);
        setError(null);
        const response = await apiClient.getUser(address);
        return response.data;
      } catch (error) {
        console.error('Error getting user registration:', error);
        setError('Failed to get user registration');
        throw error;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [apiClient]
  );

  // Set authentication error
  const setAuthError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsAuthenticating(false);
  }, []);

  // Clear authentication error
  const clearAuthError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    authMode,
    isAuthenticating,
    error,

    // Actions
    startNewAccount,
    startImportAccount,
    resetAuthFlow,
    completeAuthentication,
    setAuthError,
    clearAuthError,

    // API integration
    getUserRegistration,
    uploadRegistration,
  };
};
