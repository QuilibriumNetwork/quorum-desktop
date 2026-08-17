/**
 * Redacts caught errors before they reach a logger.
 *
 * WHY THIS EXISTS
 * ---------------
 * `DoubleRatchetInboxDecrypt` runs `JSON.parse()` on already-DECRYPTED content
 * (linked SDK `quilibrium-js-sdk-channels`, `src/channel/channel.ts:1175`). When
 * a decrypted payload is not valid JSON, V8 echoes the first 10 characters of it
 * into the SyntaxError message:
 *
 *   JSON.parse("Hey, meet me at midnight")
 *   -> SyntaxError: Unexpected token 'H', "Hey, meet "... is not valid JSON
 *
 * That error object is forwarded verbatim to `logger.error` in MessageService,
 * so an unredacted log line carries the opening of somebody's message. The
 * crypto layer itself is clean — a genuine AEAD failure yields the opaque
 * `Decryption failed: aead::Error` and nothing more (measured against the real
 * WASM binary) — so this is purely a JS-layer echo problem.
 *
 * Full write-up, including the measurement and its control arm:
 * .agents/issues/.open/2026-08-17-decrypt-error-messages-leak-ten-characters-of-plaintext.md
 *
 * WHY QUOTE-STRIPPING RATHER THAN A WHITELIST
 * -------------------------------------------
 * Quoting is how JS engines conventionally delimit echoed input, so removing
 * quoted spans kills the echo while leaving the diagnostic remainder ("is not
 * valid JSON", "Decryption failed: aead::Error") intact. A whitelist would be
 * stricter but would discard exactly the signal the logging work is trying to
 * recover.
 *
 * ⚠️ ENGINE-SPECIFIC. The 10-character echo is V8 behaviour. Hermes/JSC on React
 * Native format parse errors differently, so if this moves to quorum-shared it
 * needs its own measured control arm on that engine before being trusted there.
 * The `CONTROL` cases in decryptErrorRedaction.unit.test.ts fail loudly if the
 * engine stops echoing in the shape assumed here.
 *
 * MIGRATION CANDIDATE: platform-agnostic, and quorum-mobile consumes the same
 * SDK and therefore has the same leak. Belongs in quorum-shared once the Hermes
 * behaviour above has been measured.
 */

export interface RedactedError {
  name: string;
  message: string;
}

/** Spans an engine may have filled with echoed input. */
const QUOTED_SPAN = /"[^"]*"|'[^']*'/g;

export const safeError = (e: unknown): RedactedError => {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message.replace(QUOTED_SPAN, '<redacted>'),
    };
  }

  // Non-Error throwables can be anything at all, including a raw decrypted
  // payload. There is no safe subset to keep, so keep none of it.
  return { name: 'Unknown', message: '<redacted non-Error throwable>' };
};
