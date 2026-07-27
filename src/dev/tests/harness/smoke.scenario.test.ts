// Offline sanity check — verifies the crypto/identity pipeline loads and runs
// under the node vitest config with ZERO network effect (wasm init, key
// generation, registration construction, address derivation, pubkey round-trip).
// Safe to run in CI; hits no relay.
import { test, expect } from 'vitest';
import { channel, channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
import { sha256 } from 'multiformats/hashes/sha2';
import { base58btc } from 'multiformats/bases/base58';

test('smoke: SDK wasm + identity construction works headlessly (no network)', async () => {
  // wasm inited in setup → generate a fresh ed448 account key. The generator
  // returns {private_key, public_key} with no `type`; the app adds it.
  const kp = JSON.parse(channel_raw.js_generate_ed448()) as {
    private_key: number[];
    public_key: number[];
  };
  expect(kp.public_key.length).toBeGreaterThan(0);
  const userKey: channel.Ed448Keypair = {
    type: 'ed448',
    private_key: kp.private_key,
    public_key: kp.public_key,
  };

  const userKeyset = channel.NewUserKeyset(userKey);
  const deviceKeyset = await channel.NewDeviceKeyset();
  expect(deviceKeyset.inbox_keyset.inbox_address.length).toBeGreaterThan(0);

  const registration = await channel.ConstructUserRegistration(userKeyset, [], [
    deviceKeyset,
  ]);
  expect(registration.device_registrations.length).toBe(1);
  expect(registration.signature.length).toBeGreaterThan(0);

  // Address derivation matches ConstructUserRegistration's user_address.
  const digest = await sha256.digest(
    Buffer.from(new Uint8Array(userKeyset.user_key.public_key))
  );
  const address = base58btc.baseEncode(digest.bytes);
  expect(address).toBe(registration.user_address);

  // Public-key-from-private derivation (the from-hex path) round-trips.
  const privHex = Buffer.from(new Uint8Array(userKey.private_key)).toString('hex');
  const pubB64 = channel_raw.js_get_pubkey_ed448(
    Buffer.from(privHex, 'hex').toString('base64')
  );
  const derivedPub = [...new Uint8Array(Buffer.from(pubB64, 'base64'))];
  expect(derivedPub).toEqual(userKey.public_key);

  console.log(`[smoke] ok — address ${address}, inbox ${deviceKeyset.inbox_keyset.inbox_address}`);
});
