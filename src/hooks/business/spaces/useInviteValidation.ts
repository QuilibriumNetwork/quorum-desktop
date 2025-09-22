import { useState, useEffect, useCallback } from 'react';
import { channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { Space } from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { getValidInvitePrefixes } from '@/utils/inviteDomain';

interface ValidatedSpace {
  iconUrl: string;
  spaceName: string;
  spaceId: string;
}

interface InviteInfo {
  spaceId: string;
  configKey: string;
}

export const useInviteValidation = () => {
  const [validatedSpace, setValidatedSpace] = useState<
    ValidatedSpace | undefined
  >(undefined);
  const [validationError, setValidationError] = useState<string>();
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const { apiClient } = useQuorumApiClient();

  const parseInviteLink = useCallback(
    (inviteLink: string): InviteInfo | null => {
      const validPrefixes = getValidInvitePrefixes();

      const matchingPrefix = validPrefixes.find((prefix) =>
        inviteLink.startsWith(prefix)
      );
      if (!matchingPrefix) {
        return null;
      }

      const hashContent = inviteLink.split('#')[1];
      if (!hashContent) {
        return null;
      }

      const params = hashContent
        .split('&')
        .map((l) => {
          const [key, value] = l.split('=');
          if (!key || !value || (key !== 'spaceId' && key !== 'configKey')) {
            return undefined;
          }
          return { [key]: value };
        })
        .filter((l) => !!l)
        .reduce((prev, curr) => Object.assign(prev, curr), {});

      if (params && params.spaceId && params.configKey) {
        return params as InviteInfo;
      }

      return null;
    },
    []
  );

  const validateInvite = useCallback(
    async (inviteLink: string) => {
      setValidationError(undefined);
      setValidatedSpace(undefined);
      setIsValidating(true);

      try {
        const inviteInfo = parseInviteLink(inviteLink);
        if (!inviteInfo) {
          setIsValidating(false);
          return;
        }

        const manifest = await apiClient.getSpaceManifest(inviteInfo.spaceId);
        if (!manifest) {
          throw new Error(t`invalid response`);
        }

        const ciphertext = JSON.parse(manifest.data.space_manifest) as {
          ciphertext: string;
          initialization_vector: string;
          associated_data: string;
        };

        const decryptedData = ch.js_decrypt_inbox_message(
          JSON.stringify({
            inbox_private_key: [
              ...new Uint8Array(Buffer.from(inviteInfo.configKey, 'hex')),
            ],
            ephemeral_public_key: [
              ...new Uint8Array(
                Buffer.from(manifest.data.ephemeral_public_key, 'hex')
              ),
            ],
            ciphertext: ciphertext,
          })
        );

        const space = JSON.parse(
          Buffer.from(JSON.parse(decryptedData)).toString('utf-8')
        ) as Space;

        setValidatedSpace({
          iconUrl: space.iconUrl,
          spaceName: space.spaceName,
          spaceId: space.spaceId,
        });
      } catch (e) {
        setValidationError(t`Could not verify invite`);
      } finally {
        setIsValidating(false);
      }
    },
    [apiClient, parseInviteLink]
  );

  const clearValidation = useCallback(() => {
    setValidatedSpace(undefined);
    setValidationError(undefined);
  }, []);

  return {
    validatedSpace,
    validationError,
    isValidating,
    validateInvite,
    parseInviteLink,
    clearValidation,
  };
};
