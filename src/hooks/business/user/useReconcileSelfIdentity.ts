/**
 * Repairs the device-local passkey record (`currentPasskeyInfo`) from the
 * synced `UserConfig` blob whenever they disagree.
 *
 * Almost every read site for "my own name/avatar" — the NavRail avatar and
 * its hover tooltip, the DM self entry, the user's own name in search
 * results, ~15 sites in all — reads `currentPasskeyInfo` from
 * `usePasskeysContext()`, a device-local localStorage record that ONLY this
 * device's own profile save ever writes. The user's global display
 * name/avatar sync between devices inside the encrypted `UserConfig` blob,
 * but almost nothing reads that blob back into the local record. So
 * renaming yourself on another device can never reach this one.
 *
 * Repairing this single record repairs every read site at once, instead of
 * editing fifteen files.
 *
 * 🔴 NEVER write an empty name. `ConfigService.getConfig` returns a default
 * config with no `name` whenever there is neither a network response nor a
 * stored config — the ordinary cold-start / offline-first-run state. Because
 * every read site shares this one in-memory object, one empty write would
 * blank the display name everywhere simultaneously. See
 * `shouldReconcileSelfIdentity` below, and the existing precedent this
 * mirrors at `useUnifiedOnboardingFlow.ts` (`if (validatedName)`).
 */

import { useEffect, useRef } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { logger } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface SyncedIdentity {
  name?: string;
  profile_image?: string;
}
interface StoredIdentity {
  displayName?: string;
  pfpUrl?: string;
}

/**
 * Pure decision: what, if anything, to write back to the passkey record.
 * Returns null when nothing should be written.
 *
 * NEVER returns a write that blanks an existing name — getConfig returns a
 * nameless default on a cold start, and ~15 call sites read the single
 * in-memory passkey object, so one empty write blanks all of them.
 */
export function shouldReconcileSelfIdentity(
  config: SyncedIdentity | undefined,
  stored: StoredIdentity
): { displayName: string; pfpUrl?: string } | null {
  const syncedName = config?.name?.trim();
  if (!syncedName) return null;

  const syncedIcon = config?.profile_image || undefined;
  const nameChanged = syncedName !== stored.displayName;
  const iconChanged = Boolean(syncedIcon) && syncedIcon !== stored.pfpUrl;
  if (!nameChanged && !iconChanged) return null;

  return { displayName: syncedName, pfpUrl: syncedIcon ?? stored.pfpUrl };
}

export function useReconcileSelfIdentity(): void {
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const address = currentPasskeyInfo?.address;
  const lastAppliedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    (async () => {
      try {
        const config = await messageDB.getUserConfig({ address });
        const write = shouldReconcileSelfIdentity(config, {
          displayName: currentPasskeyInfo?.displayName,
          pfpUrl: currentPasskeyInfo?.pfpUrl,
        });
        if (!write) return;

        const signature = `${write.displayName}|${write.pfpUrl}`;
        if (lastAppliedRef.current === signature) return;

        if (cancelled || !currentPasskeyInfo) return;

        lastAppliedRef.current = signature;
        updateStoredPasskey(currentPasskeyInfo.credentialId, {
          credentialId: currentPasskeyInfo.credentialId,
          address: currentPasskeyInfo.address,
          publicKey: currentPasskeyInfo.publicKey,
          displayName: write.displayName,
          pfpUrl: write.pfpUrl,
          completedOnboarding: true,
        });
      } catch (error) {
        // Non-fatal: the stored value keeps rendering, which is today's
        // behaviour. Don't rethrow — this is a best-effort background sync.
        logger.warn('[ReconcileSelfIdentity] reconcile failed', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, currentPasskeyInfo, messageDB, updateStoredPasskey]);
}
