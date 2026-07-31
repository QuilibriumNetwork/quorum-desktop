import { useCallback } from 'react';
import {
  usePasskeysContext,
  channel as secureChannel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { logger } from '@quilibrium/quorum-shared';
import { useRegistration } from '../../queries';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useWebSocket } from '../../../components/context/WebsocketProvider';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';
import { planDeviceDeregistration } from '../../../utils/deviceRegistration';

export type DeregisterOutcome =
  /** This device is no longer in the hub device list (uploaded, or already absent). */
  | 'deregistered'
  /** Couldn't attempt it — no keyset yet. Caller proceeds; a ghost may remain. */
  | 'skipped'
  /** Attempted and failed or timed out. Caller proceeds; a ghost may remain. */
  | 'failed';

/**
 * Total budget for the goodbye. Both steps run in parallel, so this is roughly
 * the worst case a user waits after confirming a reset — long enough for a
 * round trip on a slow connection, short enough not to feel broken.
 */
export const DEREGISTER_TIMEOUT_MS = 3000;

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

/**
 * Remove THIS device from the account before its keys are destroyed.
 *
 * Reset wipes the local device keyset, which is the only handle to this
 * device's hub entry and the only key that can revoke its per-space signing
 * admission. Wiping first therefore orphans both: the hub entry can only be
 * cleared by hand from another device, and every reset+re-login cycle appends a
 * fresh one (10+ entries for 3-4 real devices on a test account). So the
 * goodbye has to happen while the keys still exist.
 *
 * Two independent cleanups, run in parallel under one bounded budget:
 *   1. hub UserRegistration — re-sign the device list without this device
 *   2. spaces — master-signed revoke-device tombstones, flushed to the socket
 *
 * Best-effort by design: a reset must work offline and when things are already
 * broken, so every failure path resolves rather than throws, and the caller
 * always proceeds to the wipe. The cost of failure is one leftover entry the
 * user can remove by hand, which beats a reset that refuses to run.
 */
export const useDeregisterThisDevice = () => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const uploadRegistration = useUploadRegistration();
  const { broadcastDeviceRevocations } = useMessageDB();
  const { flushOutbound } = useWebSocket();

  return useCallback(
    async (timeoutMs: number = DEREGISTER_TIMEOUT_MS): Promise<DeregisterOutcome> => {
      const thisInbox = keyset?.deviceKeyset?.inbox_keyset?.inbox_address;

      // RegistrationPersister populates the keyset ~200ms after mount; a user
      // who types RESET faster than that gets the old behavior, not a crash.
      if (!keyset?.userKeyset || !thisInbox) {
        logger.warn('[Deregister] no keyset at reset time — skipping the goodbye');
        return 'skipped';
      }

      const { status, remainingDevices } = planDeviceDeregistration(
        registration?.registration?.device_registrations,
        thisInbox
      );

      const removeFromHub = async (): Promise<boolean> => {
        if (status === 'not-listed') return true; // already absent — nothing to write
        try {
          const updated = await secureChannel.ConstructUserRegistration(
            keyset.userKeyset,
            remainingDevices,
            [] // no new devices
          );
          await uploadRegistration({
            address: currentPasskeyInfo!.address,
            registration: updated,
          });
          return true;
        } catch (err) {
          logger.warn('[Deregister] hub deregister failed', { err, status });
          return false;
        }
      };

      // Revoke even when the hub entry was already gone: the signing admission
      // is anchored to the master key, not the device list, so the two can be
      // out of step. Idempotent (LWW) if another device already revoked it.
      const revokeInSpaces = async (): Promise<void> => {
        try {
          await broadcastDeviceRevocations([thisInbox]);
          // Enqueueing isn't sending. Without this the reload cancels the
          // frames and the revoke silently never happens.
          await flushOutbound(timeoutMs);
        } catch (err) {
          logger.warn('[Deregister] revoke broadcast failed', err);
        }
      };

      // Parallel: independent transports with no ordering between them, so the
      // user waits for the slower one rather than both.
      const hubRemoved = await withTimeout(
        Promise.all([removeFromHub(), revokeInSpaces()]).then(([ok]) => ok),
        timeoutMs,
        false
      );

      return hubRemoved ? 'deregistered' : 'failed';
    },
    [
      keyset,
      registration,
      currentPasskeyInfo,
      uploadRegistration,
      broadcastDeviceRevocations,
      flushOutbound,
    ]
  );
};
