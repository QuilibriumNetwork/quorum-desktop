import { describe, it, expect } from 'vitest';
import { planDeviceDeregistration } from '../../../utils/deviceRegistration';

const device = (inbox: string) => ({
  inbox_registration: { inbox_address: inbox },
});

const inboxes = (devices: { inbox_registration: { inbox_address: string } }[]) =>
  devices.map((d) => d.inbox_registration.inbox_address);

describe('planDeviceDeregistration', () => {
  it('drops this device and keeps the others, in order', () => {
    const devices = [device('phone'), device('laptop'), device('work-pc')];

    const plan = planDeviceDeregistration(devices, 'laptop');

    expect(plan.status).toBe('ok');
    expect(inboxes(plan.remainingDevices)).toEqual(['phone', 'work-pc']);
  });

  it('reports last-device when this was the only entry', () => {
    const plan = planDeviceDeregistration([device('laptop')], 'laptop');

    expect(plan.status).toBe('last-device');
    expect(plan.remainingDevices).toEqual([]);
  });

  it('reports not-listed when this device is absent (already removed elsewhere)', () => {
    const devices = [device('phone'), device('work-pc')];

    const plan = planDeviceDeregistration(devices, 'laptop');

    // Unchanged list, so the caller skips a pointless re-sign and upload.
    expect(plan.status).toBe('not-listed');
    expect(inboxes(plan.remainingDevices)).toEqual(['phone', 'work-pc']);
  });

  it('reports not-listed for an empty, undefined, or null device list', () => {
    expect(planDeviceDeregistration([], 'laptop').status).toBe('not-listed');
    expect(planDeviceDeregistration(undefined, 'laptop').status).toBe('not-listed');
    expect(planDeviceDeregistration(null, 'laptop').status).toBe('not-listed');
  });

  it('reports not-listed when the local inbox address is missing', () => {
    // The keyset guard should catch this first; belt and braces so a blank
    // address can never filter every device off the account.
    const devices = [device('phone'), device('laptop')];

    expect(planDeviceDeregistration(devices, undefined).status).toBe('not-listed');
    expect(inboxes(planDeviceDeregistration(devices, '').remainingDevices)).toEqual([
      'phone',
      'laptop',
    ]);
  });

  it('removes every entry sharing this inbox address', () => {
    // Duplicates shouldn't exist, but a half-failed earlier write could leave
    // one; the goodbye must not leave a copy of itself behind.
    const devices = [device('laptop'), device('phone'), device('laptop')];

    const plan = planDeviceDeregistration(devices, 'laptop');

    expect(plan.status).toBe('ok');
    expect(inboxes(plan.remainingDevices)).toEqual(['phone']);
  });

  it('leaves malformed entries untouched rather than dropping them', () => {
    const devices = [{}, { inbox_registration: {} }, device('laptop')];

    const plan = planDeviceDeregistration(devices, 'laptop');

    expect(plan.status).toBe('ok');
    expect(plan.remainingDevices).toHaveLength(2);
  });

  it('does not mutate the input list', () => {
    const devices = [device('phone'), device('laptop')];

    planDeviceDeregistration(devices, 'laptop');

    expect(inboxes(devices)).toEqual(['phone', 'laptop']);
  });
});
