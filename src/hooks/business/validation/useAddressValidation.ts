import { useState, useEffect, useCallback } from 'react';
import { base58btc } from 'multiformats/bases/base58';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';

interface AddressValidationResult {
  isValid: boolean;
  error: string | null;
  isRegistered: boolean;
  isOwnAddress: boolean;
  isValidating: boolean;
}

export const useAddressValidation = (address: string) => {
  const [validationResult, setValidationResult] = useState<AddressValidationResult>({
    isValid: false,
    error: null,
    isRegistered: false,
    isOwnAddress: false,
    isValidating: false,
  });

  const { apiClient } = useQuorumApiClient();
  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address;

  const lookupUser = useCallback(async (addressToLookup: string): Promise<boolean> => {
    setValidationResult(prev => ({ ...prev, isValidating: true }));
    try {
      await apiClient.getUser(addressToLookup);
      return true;
    } catch (e) {
      return false;
    } finally {
      setValidationResult(prev => ({ ...prev, isValidating: false }));
    }
  }, [apiClient]);

  useEffect(() => {
    // Reset validation state
    setValidationResult({
      isValid: false,
      error: null,
      isRegistered: false,
      isOwnAddress: false,
      isValidating: false,
    });

    if (!address) return;

    // Check if address is the same as own address
    if (address === ownAddress) {
      setValidationResult({
        isValid: false,
        error: t`You cannot send a direct message to yourself.`,
        isRegistered: false,
        isOwnAddress: true,
        isValidating: false,
      });
      return;
    }

    // Check if address is exactly 46 characters long
    if (address.length !== 46) {
      setValidationResult({
        isValid: false,
        error: t`Addresses must be exactly 46 characters long.`,
        isRegistered: false,
        isOwnAddress: false,
        isValidating: false,
      });
      return;
    }

    // Check if address starts with Qm
    if (!address.startsWith('Qm')) {
      setValidationResult({
        isValid: false,
        error: t`Addresses start with "Qm".`,
        isRegistered: false,
        isOwnAddress: false,
        isValidating: false,
      });
      return;
    }

    // Check base58 format
    try {
      base58btc.baseDecode(address);
    } catch {
      setValidationResult({
        isValid: false,
        error: t`Invalid address format. Addresses must use valid alphanumeric characters.`,
        isRegistered: false,
        isOwnAddress: false,
        isValidating: false,
      });
      return;
    }

    // If all basic validations pass, check if user is registered
    lookupUser(address).then((isRegistered: boolean) => {
      setValidationResult({
        isValid: isRegistered,
        error: isRegistered ? null : t`User does not exist.`,
        isRegistered,
        isOwnAddress: false,
        isValidating: false,
      });
    });
  }, [address, ownAddress, lookupUser]);

  return validationResult;
};