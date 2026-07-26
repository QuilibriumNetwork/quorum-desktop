/**
 * A failed DM decrypt must report itself as a decrypt failure.
 *
 * The crypto core does not throw on AEAD failure — it returns the error string
 * in the plaintext slot. Parsing that with JSON.parse produced
 * `SyntaxError: Unexpected token 'D', "Decryption"... is not valid JSON`, which
 * reads like a serialization bug in our own code and was the visible face of
 * every DM decrypt failure in the logs for months (captured live 2026-07-26,
 * frame fp=a204cc78).
 *
 * These tests pin the diagnosis, not the control flow: a decrypt failure must
 * still THROW, so the caller's existing catch still skips the frame, keeps the
 * session, and never persists the advanced state.
 */
import { describe, expect, it } from 'vitest';
import {
  parseDecryptedMessage,
  DmDecryptError,
} from '../../../services/MessageService';

describe('parseDecryptedMessage', () => {
  it('reports the core\'s AEAD failure as a DmDecryptError, not a SyntaxError', () => {
    expect(() =>
      parseDecryptedMessage('Decryption failed: aead::Error', 'InboxDecrypt')
    ).toThrow(DmDecryptError);

    try {
      parseDecryptedMessage('Decryption failed: aead::Error', 'InboxDecrypt');
      expect.unreachable('must throw');
    } catch (err) {
      // The whole point: the message names the real problem and the branch.
      expect((err as Error).message).toContain('failed to decrypt');
      expect((err as Error).message).toContain('InboxDecrypt');
      expect((err as Error).message).toContain('aead::Error');
      expect((err as Error).name).toBe('DmDecryptError');
      expect(err).not.toBeInstanceOf(SyntaxError);
    }
  });

  it('carries the branch so a failure names which decrypt path produced it', () => {
    for (const branch of ['Confirm', 'InboxDecrypt', 'InitEnvelope']) {
      try {
        parseDecryptedMessage('Decryption failed: aead::Error', branch);
        expect.unreachable('must throw');
      } catch (err) {
        expect((err as DmDecryptError).branch).toBe(branch);
        expect((err as DmDecryptError).detail).toBe(
          'Decryption failed: aead::Error'
        );
      }
    }
  });

  it('still throws, so callers keep skipping the frame and discarding state', () => {
    // Behaviour must be unchanged — only the diagnosis improves. If this ever
    // returns instead of throwing, a failed frame would be treated as a real
    // message and the advanced ratchet state would be persisted, which the
    // Double Ratchet spec forbids.
    expect(() => parseDecryptedMessage('Decryption failed', 'Confirm')).toThrow();
  });

  it('parses a genuine decrypted payload unchanged', () => {
    const message = { messageId: 'abc', content: { type: 'post', text: 'hi' } };
    expect(parseDecryptedMessage(JSON.stringify(message), 'InboxDecrypt')).toEqual(
      message
    );
  });

  it('does not mistake ordinary content beginning with "Decryption" for a failure', () => {
    // The sentinel is matched at the START of the raw payload, and a real
    // payload is always JSON — so a message whose TEXT begins with the word
    // must still parse normally.
    const message = {
      messageId: 'abc',
      content: { type: 'post', text: 'Decryption failed on my end, resend?' },
    };
    expect(parseDecryptedMessage(JSON.stringify(message), 'InboxDecrypt')).toEqual(
      message
    );
  });

  it('still surfaces genuinely malformed JSON as a parse error', () => {
    // Not our sentinel — a real serialization problem must not be disguised as
    // a decrypt failure either.
    expect(() => parseDecryptedMessage('{"unterminated', 'InboxDecrypt')).toThrow(
      SyntaxError
    );
  });
});
