import { describe, expect, it } from 'vitest';
import { safeError } from '../../../utils/safeError';

// A stand-in for real decrypted message content. Never use a real address or a
// real message here — see .agents/AGENTS.md on fixture data.
const CANARY = 'CANARY-b7f3e9a1-TOP-SECRET-MESSAGE-BODY';

/**
 * Reproduces the exact failure shape this redaction exists for.
 *
 * `DoubleRatchetInboxDecrypt` runs `JSON.parse()` on ALREADY-DECRYPTED content
 * (linked SDK `quilibrium-js-sdk-channels`, `src/channel/channel.ts:1175`). When
 * that plaintext is not valid JSON, V8 echoes its first 10 characters into the
 * SyntaxError message. `MessageService.ts:4661` then forwards that error object
 * straight to `logger.error`.
 *
 * See .agents/issues/.open/2026-08-17-decrypt-error-messages-leak-ten-characters-of-plaintext.md
 */
const errorFromParsingDecryptedContent = (plaintext: string): Error => {
  try {
    JSON.parse(plaintext);
    throw new Error('fixture is wrong: JSON.parse was expected to throw');
  } catch (e) {
    return e as Error;
  }
};

describe('safeError — redacting plaintext echoed by V8 into error messages', () => {
  it('CONTROL: the raw error really does leak plaintext', () => {
    // If this ever fails, V8 changed its message format and every assertion
    // below is passing vacuously. This arm must stay red-capable.
    const raw = errorFromParsingDecryptedContent(CANARY);
    expect(raw.message).toContain(CANARY.slice(0, 10));
  });

  it('strips the echoed plaintext', () => {
    const raw = errorFromParsingDecryptedContent(CANARY);
    expect(JSON.stringify(safeError(raw))).not.toContain(CANARY.slice(0, 10));
  });

  it('leaks nothing regardless of what the plaintext starts with', () => {
    // The leak only fires when the FIRST token is invalid JSON, but the redaction
    // must not depend on that — a future SDK change could widen the surface.
    const openings = [
      'Hey, meet me at',
      '{not quite json',
      '[1,2,3 unterminated',
      '"unterminated string',
      'null and then some',
    ];
    for (const opening of openings) {
      const raw = errorFromParsingDecryptedContent(`${opening} ${CANARY}`);
      const out = JSON.stringify(safeError(raw));
      expect(out).not.toContain(CANARY.slice(0, 10));
      expect(out).not.toContain(opening.slice(0, 10));
    }
  });

  it('CONTROL: preserves diagnostic value — an opaque crypto error survives intact', () => {
    // This is the other control arm. Redaction that also destroys the useful
    // signal would make the logs worthless, which is the whole point of the
    // parent issue. `aead::Error` is RustCrypto's opaque type and carries no
    // data, so it must come through unchanged.
    const raw = new Error('Decryption failed: aead::Error');
    const safe = safeError(raw);
    expect(safe.message).toBe('Decryption failed: aead::Error');
    expect(safe.name).toBe('Error');
  });

  it('keeps the error name so failures stay distinguishable', () => {
    const raw = errorFromParsingDecryptedContent(CANARY);
    expect(safeError(raw).name).toBe('SyntaxError');
  });

  it('handles non-Error throwables without leaking them', () => {
    expect(JSON.stringify(safeError(CANARY))).not.toContain(CANARY.slice(0, 10));
    expect(JSON.stringify(safeError({ secret: CANARY }))).not.toContain(
      CANARY.slice(0, 10)
    );
    expect(safeError(undefined).name).toBe('Unknown');
  });
});
