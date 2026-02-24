import { useEffect, useRef } from 'react';
import { logger } from '@quilibrium/quorum-shared';
import { Space } from '../../../api/quorumApi';
import { UserConfig } from '../../../db/messages';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

interface UseSpaceTagStartupRefreshProps {
  spaces: Space[];
  config: UserConfig | null | undefined;
}

/**
 * Runs once on app startup (after spaces and config are loaded) to check whether
 * the user's selected space tag is still valid and matches the current tag data.
 *
 * Handles two scenarios automatically:
 * - Space owner changed the tag design → re-broadcasts user's profile with fresh tag data
 * - Space owner deleted the tag (or user left that space) → clears spaceTagId and re-broadcasts
 */
export const useSpaceTagStartupRefresh = ({
  spaces,
  config,
}: UseSpaceTagStartupRefreshProps) => {
  const { updateUserProfile, actionQueueService } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const hasRun = useRef(false);

  useEffect(() => {
    // Run only once per session, only when both spaces and config are loaded
    if (hasRun.current || !config || !currentPasskeyInfo || spaces.length === 0) return;
    hasRun.current = true;

    if (!config.spaceTagId) return;

    (async () => {
      try {
        const tagSpace = spaces.find((s) => s.spaceId === config.spaceTagId);

        if (!tagSpace?.spaceTag?.letters) {
          // Space no longer has a tag (owner deleted it, or user left the space)
          // Clear the stale selection and broadcast with no tag
          try {
            const newConfig = { ...config, spaceTagId: undefined };
            await actionQueueService.enqueue(
              'save-user-config',
              { config: newConfig },
              `config:${currentPasskeyInfo.address}`
            );
            await updateUserProfile(
              currentPasskeyInfo.displayName ?? '',
              currentPasskeyInfo.pfpUrl ?? '',
              currentPasskeyInfo,
              undefined
            );
          } catch (clearErr) {
            logger.error('Failed to clear stale space tag on startup', clearErr);
          }
          return;
        }

        // Space still has a tag — check if the design changed since last broadcast
        // We compare the stored tag data in the user's own space_members record against
        // the current tag defined by the space owner.
        const currentTag = tagSpace.spaceTag;
        const lastBroadcastTag = config.lastBroadcastSpaceTag;

        const tagChanged =
          !lastBroadcastTag ||
          lastBroadcastTag.letters !== currentTag.letters ||
          lastBroadcastTag.url !== currentTag.url;

        if (tagChanged) {
          const broadcastTag = { ...currentTag, spaceId: tagSpace.spaceId };
          try {
            await updateUserProfile(
              currentPasskeyInfo.displayName ?? '',
              currentPasskeyInfo.pfpUrl ?? '',
              currentPasskeyInfo,
              broadcastTag
            );
            // Persist the broadcast tag data so we don't re-broadcast unnecessarily next startup
            const newConfig = {
              ...config,
              lastBroadcastSpaceTag: currentTag,
            };
            await actionQueueService.enqueue(
              'save-user-config',
              { config: newConfig },
              `config:${currentPasskeyInfo.address}`
            );
          } catch (broadcastErr) {
            logger.error('Failed to re-broadcast updated space tag on startup', broadcastErr);
            // Will retry on next startup — no user impact
          }
        }
      } catch (err) {
        logger.error('Failed to refresh space tag on startup', err);
      }
    })();
  }, [spaces, config, currentPasskeyInfo, updateUserProfile, actionQueueService]);
};
