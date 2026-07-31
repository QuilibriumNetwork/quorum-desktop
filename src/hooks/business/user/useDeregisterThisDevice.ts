import { useCallback } from 'react';
import {
  usePasskeysContext,
  channel as secureChannel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistration } from '../../queries';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useWebSocket } from '../../../components/context/WebsocketProvider';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';
import { planDeviceDeregistration } from '../../../utils/deviceRegistration';

export type LegOutcome =
  /** Confirmed done. */
  | 'ok'
  /** Attempted, not confirmed — assume it didn't happen. */
  | 'failed'
  /** Couldn't attempt it (no keyset yet). */
  | 'skipped';

export interface DeregisterOutcome {
  /** The hub's device list no longer includes this device. */
  hub: LegOutcome;
  /** revoke-device tombstones for this device reached the wire. */
  spaces: LegOutcome;
}

/**
 * Per-leg budgets. Separate on purpose: the hub leg is an HTTP round trip the
 * API client itself allows 22s for, while the socket leg either drains quickly
 * or is not going to. Collapsing them into one budget made a slow revoke report
 * the hub write as failed even after it had succeeded.
 *
 * The legs run in parallel, so the user waits for the longer one, not the sum.
 */
export const HUB_TIMEOUT_MS = 8000;
export const SPACES_TIMEOUT_MS = 4000;
/** Re-reading the device list is on the critical path, so keep it tight. */
export const REFETCH_TIMEOUT_MS = 4000;

const TIMED_OUT = Symbol('timed-out');

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> =>
  Promise.race([
    promise,
    new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), ms)),
  ]);

/**
 * Remove THIS device from the account before its keys are destroyed.
 *
 * Reset wipes the local device keyset, which is the only handle to this
 * device's hub entry and the only key that can revoke its per-space signing
 * admission. Wiping first therefore orphans both: the hub entry can only be
 * cleared by hand from another device, and every reset + re-login appends a
 * fresh one (10+ entries for 3-4 real devices on a test account). So the
 * goodbye has to happen while the keys still exist.
 *
 * Two independent cleanups, reported separately because they fail separately:
 *   1. hub UserRegistration — re-sign the device list without this device
 *   2. spaces — master-signed revoke-device tombstones, flushed to the socket
 *
 * Best-effort by design: a reset must work offline and when things are already
 * broken, so every failure path resolves rather than throws, and the caller
 * always proceeds to the wipe. The cost of failure is a leftover entry the user
 * can remove by hand, which beats a reset that refuses to run.
 *
 * Diagnostics use console rather than the shared logger deliberately: that
 * logger compiles out when NODE_ENV is production, and this path leaves no
 * other trace — by the time anything could be inspected, the data is gone.
 */
export const useDeregisterThisDevice = () => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { refetch: refetchRegistration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const uploadRegistration = useUploadRegistration();
  const { broadcastDeviceRevocations } = useMessageDB();
  const { flushOutbound } = useWebSocket();

  return useCallback(async (): Promise<DeregisterOutcome> => {
    const thisInbox = keyset?.deviceKeyset?.inbox_keyset?.inbox_address;

    // RegistrationPersister populates the keyset ~200ms after mount; a user who
    // types RESET faster than that gets the old behavior, not a crash.
    if (!keyset?.userKeyset || !thisInbox) {
      console.warn('[Deregister] no keyset at reset time — skipping the goodbye');
      return { hub: 'skipped', spaces: 'skipped' };
    }

    const removeFromHub = async (): Promise<LegOutcome> => {
      try {
        // Re-read the list first. The cached copy can be minutes old (settings
        // left open) and the upload replaces the list wholesale, so a device
        // registered elsewhere in the meantime would be silently deleted. If
        // the re-read fails the hub is unreachable and the upload would fail
        // too, so skipping is strictly safer than writing a stale list.
        const fresh = await withTimeout(refetchRegistration(), REFETCH_TIMEOUT_MS);
        if (fresh === TIMED_OUT || fresh.error) {
          console.warn('[Deregister] could not re-read the device list', fresh);
          return 'failed';
        }

        const { status, remainingDevices } = planDeviceDeregistration(
          fresh.data?.registration?.device_registrations,
          thisInbox
        );

        if (status === 'not-listed') return 'ok'; // already absent — nothing to write

        const updated = await secureChannel.ConstructUserRegistration(
          keyset.userKeyset,
          remainingDevices,
          [] // no new devices
        );
        await uploadRegistration({
          address: currentPasskeyInfo!.address,
          registration: updated,
          // Abort at our own deadline instead of leaving a request in flight
          // for the reload to cancel. The client's 22s default outlives the
          // page, which is how the write silently went missing.
          timeout: HUB_TIMEOUT_MS,
        });
        return 'ok';
      } catch (err) {
        console.warn('[Deregister] hub deregister failed', err);
        return 'failed';
      }
    };

    // Revoke even when the hub entry was already gone: the signing admission is
    // anchored to the master key, not the device list, so the two can be out of
    // step. Idempotent (LWW) if another device already revoked it.
    const revokeInSpaces = async (): Promise<LegOutcome> => {
      try {
        await broadcastDeviceRevocations([thisInbox]);
        // Enqueueing isn't sending. Without confirming the flush, the reload
        // cancels the frames and the revoke silently never happens — so the
        // barrier's answer decides this leg's outcome rather than being
        // discarded.
        const flushed = await flushOutbound(SPACES_TIMEOUT_MS);
        if (!flushed) {
          console.warn('[Deregister] revoke frames were not confirmed on the wire');
          return 'failed';
        }
        return 'ok';
      } catch (err) {
        console.warn('[Deregister] revoke broadcast failed', err);
        return 'failed';
      }
    };

    // Independently bounded so a slow leg can never overwrite the other leg's
    // result, and parallel because they share no ordering.
    const [hub, spaces] = await Promise.all([
      withTimeout(removeFromHub(), HUB_TIMEOUT_MS),
      withTimeout(revokeInSpaces(), SPACES_TIMEOUT_MS),
    ]);

    return {
      hub: hub === TIMED_OUT ? 'failed' : hub,
      spaces: spaces === TIMED_OUT ? 'failed' : spaces,
    };
  }, [
    keyset,
    refetchRegistration,
    currentPasskeyInfo,
    uploadRegistration,
    broadcastDeviceRevocations,
    flushOutbound,
  ]);
};
