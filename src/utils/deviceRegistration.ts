/**
 * Device-list reconstruction for deregister-before-wipe.
 *
 * Kept pure (no keyset, no network, no SDK types) so the one rule that decides
 * whether a reset leaves a ghost behind — which entries survive — is testable
 * without a hub or a registration context.
 */

/** Structural shape of a hub device entry; the SDK's DeviceRegistration satisfies it. */
type DeviceLike = {
  inbox_registration?: { inbox_address?: string };
};

export type DeviceDeregistrationStatus =
  /** This device was listed and other devices remain. */
  | 'ok'
  /** This device was listed and was the only one, so the list goes empty. */
  | 'last-device'
  /** Nothing to upload: empty list, no local inbox address, or this device isn't listed. */
  | 'not-listed';

export interface DeviceDeregistrationPlan<T> {
  status: DeviceDeregistrationStatus;
  /** The list to re-sign and upload. Equals the input when status is 'not-listed'. */
  remainingDevices: T[];
}

/**
 * Work out the device list to upload when THIS device removes itself.
 *
 * 'last-device' is reported rather than refused: the caller decides, and on
 * desktop an upload the hub rejects is already handled as best-effort, so
 * attempting it costs nothing and fully cleans single-device accounts if the
 * hub accepts an empty list. (Mobile's removeDeviceFromRegistration refuses
 * this case outright — a deliberate divergence, see the ghost-accumulation task.)
 */
export function planDeviceDeregistration<T extends DeviceLike>(
  devices: readonly T[] | undefined | null,
  thisInboxAddress: string | undefined | null
): DeviceDeregistrationPlan<T> {
  const all = devices ? [...devices] : [];

  if (!thisInboxAddress || all.length === 0) {
    return { status: 'not-listed', remainingDevices: all };
  }

  const remainingDevices = all.filter(
    (device) => device.inbox_registration?.inbox_address !== thisInboxAddress
  );

  // Nothing matched — another device already removed this one, or the hub list
  // predates it. Uploading the unchanged list would be a pointless write.
  if (remainingDevices.length === all.length) {
    return { status: 'not-listed', remainingDevices: all };
  }

  return {
    status: remainingDevices.length === 0 ? 'last-device' : 'ok',
    remainingDevices,
  };
}
