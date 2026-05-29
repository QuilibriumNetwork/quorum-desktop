import { useState, useCallback } from 'react';
import { channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import {
  getValidInvitePrefixes,
  parseInviteParams,
} from '@quilibrium/quorum-shared';
import type { Space } from '@quilibrium/quorum-shared';
import { t } from '@lingui/core/macro';
import { hexToSpreadArray } from '@/utils/crypto';

interface ValidatedSpace {
  iconUrl: string;
  spaceName: string;
  spaceId: string;
  description?: string;
}

export const useInviteValidation = () => {
  const [validatedSpace, setValidatedSpace] = useState<
    ValidatedSpace | undefined
  >(undefined);
  const [validationError, setValidationError] = useState<string>();
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const { apiClient } = useQuorumApiClient();

  const validateInvite = useCallback(
    async (inviteLink: string) => {
      setValidationError(undefined);
      setValidatedSpace(undefined);
      setIsValidating(true);

      try {
        const hasValidPrefix = getValidInvitePrefixes().some((prefix) =>
          inviteLink.startsWith(prefix)
        );
        if (!hasValidPrefix) {
          setIsValidating(false);
          return;
        }

        const params = parseInviteParams(inviteLink);
        if (!params?.spaceId || !params.configKey) {
          setIsValidating(false);
          return;
        }
        const inviteInfo = { spaceId: params.spaceId, configKey: params.configKey };

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
            inbox_private_key: hexToSpreadArray(inviteInfo.configKey),
            ephemeral_public_key: hexToSpreadArray(
              manifest.data.ephemeral_public_key
            ),
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
          description: space.description,
        });
      } catch (e) {
        setValidationError(t`Could not verify invite`);
      } finally {
        setIsValidating(false);
      }
    },
    [apiClient]
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
    clearValidation,
  };
};
