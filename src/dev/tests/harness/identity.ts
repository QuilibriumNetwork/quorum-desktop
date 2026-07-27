// Bot identity: turn an ed448 account key into a full, registered Quorum client
// identity — the same construction the app performs in RegistrationPersister,
// minus the passkey/WebAuthn storage layer (which cannot cross into node).
//
// Two paths:
//   - generate: mint a fresh throwaway ed448 account (slices 1-3 default)
//   - fromHex : load one of your existing test users from its 114-char key
//
// Either way the device keyset is PERSISTED to .state/<name>.json and reused, so
// repeated runs do NOT spawn a new device registration each time (that would
// feed the device-registration ghost-accumulation problem). Persisted state
// contains REAL private keys — .state/ is gitignored.
import { channel, channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
import { sha256 } from 'multiformats/hashes/sha2';
import { base58btc } from 'multiformats/bases/base58';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { QuorumApiClient } from '../../../api/baseTypes';
import { config } from './env';

export interface BotKeyset {
  userKeyset: channel.UserKeyset;
  deviceKeyset: channel.DeviceKeyset;
}

/**
 * Persisted shape. For a bot loaded from a .env private key (your real test
 * users), the userKeyset is OMITTED — we never write a second copy of your
 * account private key to disk; it is re-derived from the env hex each run. Only
 * generated throwaway bots persist their full keyset.
 */
interface StoredKeyset {
  userKeyset?: channel.UserKeyset;
  deviceKeyset: channel.DeviceKeyset;
}

export interface Bot {
  name: string;
  /** base58btc(sha256(user_key.public_key)) — the account address. */
  address: string;
  /** This device's inbox address; where DMs to this device land. */
  inboxAddress: string;
  keyset: BotKeyset;
}

/** js_generate_ed448 returns {private_key, public_key} with no type — add it. */
function withEd448Type(rawJson: string): channel.Ed448Keypair {
  const kp = JSON.parse(rawJson) as { private_key: number[]; public_key: number[] };
  return { type: 'ed448', private_key: kp.private_key, public_key: kp.public_key };
}

/** Account address = base58btc(sha256(user_key.public_key)), per ConstructUserRegistration. */
async function deriveAddress(userKeyset: channel.UserKeyset): Promise<string> {
  const digest = await sha256.digest(
    Buffer.from(new Uint8Array(userKeyset.user_key.public_key))
  );
  return base58btc.baseEncode(digest.bytes);
}

function statePath(name: string): string {
  return resolve(config.stateDir, `${name}.json`);
}

function loadState(name: string): StoredKeyset | undefined {
  const path = statePath(name);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf-8')) as StoredKeyset;
}

function saveState(name: string, stored: StoredKeyset): void {
  mkdirSync(config.stateDir, { recursive: true });
  writeFileSync(statePath(name), JSON.stringify(stored, null, 2), 'utf-8');
}

/**
 * Build a UserKeyset from a bare 114-char ed448 private key hex. Public-key
 * derivation mirrors the SDK's own key-import path (usePasskeyFlow): feed the
 * private key as base64, read the public key back as base64.
 */
function userKeysetFromHex(privateKeyHex: string): channel.UserKeyset {
  const keyHex = privateKeyHex.trim().toLowerCase();
  if (keyHex.length !== 114) {
    throw new Error(
      `Expected a 114-char ed448 private key hex, got ${keyHex.length} chars`
    );
  }
  const pubB64 = channel_raw.js_get_pubkey_ed448(
    Buffer.from(keyHex, 'hex').toString('base64')
  );
  return channel.NewUserKeyset({
    type: 'ed448',
    private_key: [...new Uint8Array(Buffer.from(keyHex, 'hex'))],
    public_key: [...new Uint8Array(Buffer.from(pubB64, 'base64'))],
  });
}

/**
 * Load a bot's identity from persisted state, or create + register it.
 *
 * @param name  stable label; picks the .state/<name>.json file and reuses the device
 * @param opts.privateKeyHex  optional — load an existing account instead of generating
 */
export async function loadOrCreateBot(
  name: string,
  apiClient: QuorumApiClient,
  opts: { privateKeyHex?: string } = {}
): Promise<Bot> {
  const saved = loadState(name);
  if (saved) {
    // Env-key bots persist device-only; re-derive the account keyset from the
    // env hex each run so the account private key is never copied to .state/.
    const userKeyset = opts.privateKeyHex
      ? userKeysetFromHex(opts.privateKeyHex)
      : saved.userKeyset;
    if (!userKeyset) {
      throw new Error(
        `state/${name}.json has no userKeyset and no privateKeyHex was given — ` +
          `set BOT_?_PRIVATE_KEY in .env.local or delete the state file`
      );
    }
    const address = await deriveAddress(userKeyset);
    return {
      name,
      address,
      inboxAddress: saved.deviceKeyset.inbox_keyset.inbox_address,
      keyset: { userKeyset, deviceKeyset: saved.deviceKeyset },
    };
  }

  // Mint the account key (or load the provided one) and a fresh device.
  // js_generate_ed448 returns {private_key, public_key} with no `type`; the app
  // supplies it explicitly (RegistrationPersister), so do the same.
  const userKeyset = opts.privateKeyHex
    ? userKeysetFromHex(opts.privateKeyHex)
    : channel.NewUserKeyset(withEd448Type(channel_raw.js_generate_ed448()));
  const deviceKeyset = await channel.NewDeviceKeyset();
  const address = await deriveAddress(userKeyset);

  // Merge our new device with any devices already registered on this account
  // (relevant when loading an existing test user), then publish the registration.
  let existingDevices: channel.DeviceRegistration[] = [];
  try {
    const existing = (await apiClient.getUser(address))?.data;
    existingDevices = existing?.device_registrations ?? [];
  } catch {
    /* first registration for this account */
  }
  const registration = await channel.ConstructUserRegistration(
    userKeyset,
    existingDevices,
    [deviceKeyset]
  );
  await apiClient.postUser(address, registration);

  // Persist device-only for env-key bots (never a second copy of your account
  // private key); full keyset for generated throwaways (which have no other home).
  saveState(name, opts.privateKeyHex ? { deviceKeyset } : { userKeyset, deviceKeyset });

  return {
    name,
    address,
    inboxAddress: deviceKeyset.inbox_keyset.inbox_address,
    keyset: { userKeyset, deviceKeyset },
  };
}
