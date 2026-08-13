import { describe, it, expect, beforeAll } from 'vitest';
import { channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * Does the config-save Ed448 signature scale with config blob size?
 *
 * Context: a browser A/B (see
 * .agents/issues/2026-08-13-notification-toggle-freeze-is-the-config-encode-chain.md)
 * showed the queued save-user-config task causes ~93% of the notification-toggle
 * freeze — one contiguous main-thread block of 1699-2372ms. That is well above
 * the ~1,000ms recorded for Ed448 in 2025-12, so either signing got slower or
 * the payload grew.
 *
 * THE QUESTION THIS ANSWERS: is blob size a lever, or is the signature a fixed
 * cost? It decides the fix. If cost scales with size, shrinking the config
 * (bookmarks are ~75% of it) shortens the freeze. If cost is flat, blob size is
 * a dead end and the only routes are signing less often, or off the main thread.
 *
 * WHAT IS ACTUALLY SIGNED (ConfigService.ts ~843): not the config, but the AES
 * ciphertext rendered as a HEX STRING, utf-8 encoded, with an 8-byte timestamp
 * appended, then base64'd. That chain expands a config of S bytes to roughly
 * 2.67*S bytes of base64 crossing the JS->WASM boundary, so payload growth is
 * amplified, not linear-with-config. This bench reproduces that exact shape.
 *
 * Every signature is VERIFIED. Without that, a stubbed or short-circuited
 * signer would report fast times and read as "signing is cheap" — the same
 * class of instrument failure that a 0ms freeze probe would have been.
 *
 * Run with `yarn bench`. Needs the REAL wasm SDK, which is why the perf config
 * uses the harness setup rather than the unit setup (the latter mocks crypto).
 */

const KB = 1024;
const MB = 1024 * KB;

let privateKeyB64: string;
let publicKeyB64: string;

/** Mirror ConfigService: hex ciphertext string -> utf8 bytes + 8 ts bytes -> base64. */
function buildSignedPayload(configBytes: number): string {
  // AES-GCM ciphertext is ~the plaintext size; ConfigService renders it as hex,
  // so the STRING is 2 chars per byte, and utf-8 encoding it is 2 bytes per byte.
  const hexChars = 'abcdef0123456789';
  let hex = '';
  const targetHexLen = configBytes * 2;
  const chunk = hexChars.repeat(4096 / hexChars.length);
  while (hex.length < targetHexLen) hex += chunk;
  hex = hex.slice(0, targetHexLen);

  const bytes = Buffer.from(hex, 'utf-8');
  const ts = Buffer.alloc(8);
  return Buffer.concat([bytes, ts]).toString('base64');
}

describe('config-save Ed448 signature — does it scale with blob size?', () => {
  beforeAll(() => {
    const kp = JSON.parse(ch.js_generate_ed448()) as {
      private_key: number[];
      public_key: number[];
    };
    privateKeyB64 = Buffer.from(new Uint8Array(kp.private_key)).toString(
      'base64'
    );
    publicKeyB64 = Buffer.from(new Uint8Array(kp.public_key)).toString('base64');
  });

  it('times signing across realistic config sizes, verifying every signature', () => {
    const sizes: [string, number][] = [
      ['10 KB', 10 * KB],
      ['100 KB', 100 * KB],
      ['500 KB', 500 * KB],
      ['1 MB', 1 * MB],
      ['2 MB', 2 * MB],
      ['4 MB', 4 * MB], // the ~4.2MB config observed in the backup-size test
    ];

    const rows: string[] = [];
    const timings: { bytes: number; ms: number }[] = [];

    for (const [label, bytes] of sizes) {
      const payload = buildSignedPayload(bytes);

      const t0 = performance.now();
      const sigJson = ch.js_sign_ed448(privateKeyB64, payload);
      const ms = performance.now() - t0;

      // Control: prove real signing happened. A no-op signer would fail here
      // and its fast timing would otherwise read as "signing is cheap".
      const sigB64 = Buffer.from(JSON.parse(sigJson), 'base64').toString(
        'base64'
      );
      const verified = JSON.parse(
        ch.js_verify_ed448(publicKeyB64, payload, sigB64)
      );
      expect(verified, `signature for ${label} must verify`).toBeTruthy();

      timings.push({ bytes, ms });
      rows.push(
        `${label.padStart(7)}  config -> ${(payload.length / MB).toFixed(2)}MB signed  ` +
          `${ms.toFixed(0).padStart(6)}ms`
      );
    }

    const smallest = timings[0];
    const largest = timings[timings.length - 1];
    const sizeRatio = largest.bytes / smallest.bytes;
    const timeRatio = largest.ms / Math.max(smallest.ms, 0.001);

    console.log(
      '\n[config signing cost]\n' +
        rows.join('\n') +
        `\n\n  size x${sizeRatio.toFixed(0)}  =>  time x${timeRatio.toFixed(1)}` +
        `\n  ${
          timeRatio > sizeRatio / 4
            ? 'SCALES with payload -> shrinking the config blob IS a lever.'
            : 'FLAT in payload -> blob size is NOT the lever; sign less often or off-thread.'
        }\n`
    );

    expect(timings.every((t) => t.ms >= 0)).toBe(true);
  }, 300_000);

  /**
   * Signing turned out to be cheap, but the browser A/B is unambiguous that the
   * config save causes the freeze. So the cost is elsewhere in that path. This
   * decomposes the ACTUAL chain in ConfigService.saveConfig (~832-857) stage by
   * stage, because the expansion is severe and easy to miss when reading:
   *
   *   config object
   *     -> JSON.stringify                    S bytes
   *     -> AES-GCM encrypt                   S bytes
   *     -> Buffer.toString('hex')            2S CHARACTER string   <-- suspect
   *     -> Buffer.from(hex,'utf-8')          2S bytes
   *     -> .toString('base64')               2.67S characters
   *     -> js_sign_ed448
   */
  it('decomposes the full save-config encode chain to find where the time actually goes', async () => {
    const subtle = (globalThis.crypto as Crypto).subtle;
    const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
    ]);

    const rows: string[] = [];

    for (const [label, bytes] of [
      ['1 MB', 1 * MB],
      ['4 MB', 4 * MB],
    ] as [string, number][]) {
      // A config-shaped object, not a flat string: JSON.stringify cost depends
      // on structure, and the real config is deeply nested (bookmarks etc).
      const config = {
        address: 'x'.repeat(48),
        bookmarks: Array.from({ length: Math.floor(bytes / 256) }, (_, i) => ({
          id: `bookmark-${i}`,
          messageId: `msg-${i}`,
          note: 'n'.repeat(180),
        })),
      };

      const t0 = performance.now();
      const configJson = JSON.stringify(config);
      const tStringify = performance.now() - t0;

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const t1 = performance.now();
      const encrypted = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        Buffer.from(configJson, 'utf-8')
      );
      const tEncrypt = performance.now() - t1;

      const t2 = performance.now();
      const ciphertext =
        Buffer.from(encrypted).toString('hex') +
        Buffer.from(iv).toString('hex');
      const tHex = performance.now() - t2;

      const t3 = performance.now();
      const signedPayload = Buffer.concat([
        Buffer.from(ciphertext, 'utf-8'),
        Buffer.alloc(8),
      ]).toString('base64');
      const tBase64 = performance.now() - t3;

      const t4 = performance.now();
      ch.js_sign_ed448(privateKeyB64, signedPayload);
      const tSign = performance.now() - t4;

      const total = tStringify + tEncrypt + tHex + tBase64 + tSign;
      rows.push(
        `  ${label}  json=${tStringify.toFixed(0)}ms  aes=${tEncrypt.toFixed(0)}ms  ` +
          `hex=${tHex.toFixed(0)}ms  base64=${tBase64.toFixed(0)}ms  ` +
          `sign=${tSign.toFixed(0)}ms   TOTAL=${total.toFixed(0)}ms`
      );
    }

    console.log('\n[save-config encode chain, per stage]\n' + rows.join('\n') + '\n');
    expect(rows.length).toBe(2);
  }, 300_000);
});
