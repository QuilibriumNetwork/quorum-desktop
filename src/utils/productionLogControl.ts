import { logger } from '@quilibrium/quorum-shared';

/**
 * Makes the logger's production escape hatch reachable.
 *
 * WHY THIS EXISTS
 * ---------------
 * quorum-shared's logger disables itself in production builds, so every
 * logger.debug/log/warn/error call is discarded and no real user's session can
 * ever produce a diagnostic. That default is CORRECT and must stay: the `log`
 * tier prints decrypted message plaintext (MessageService's TripleRatchet
 * decrypt path), and printing conversation content to a console in a
 * privacy-focused messenger is a serious regression.
 *
 * The logger already shipped an intended way out — `logger.enable()`, documented
 * in quorum-shared as "useful for debugging production issues" — but `logger` is
 * module-private inside the bundle, so in a production build nothing can reach
 * it. The escape hatch has never worked. This module makes it reachable.
 *
 * ⚠️ WHY A WRAPPER AND NOT THE LOGGER ITSELF
 * Exposing `logger` directly would be actively dangerous. `logger.enable()`
 * sets `enabled = true` but leaves `minLevel` at its default of `'log'`, and
 * since LOG_LEVELS.log (1) >= LOG_LEVELS.log (1) that re-arms the ENTIRE log
 * tier, plaintext sites included. This wrapper pins `minLevel: 'warn'` so the
 * `log` tier fails the threshold and stays dark no matter what anyone types.
 * Never widen this to expose `logger` or `configure` directly.
 *
 * Two independent guarantees, deliberately not one:
 *   1. minLevel: 'warn' — the plaintext-printing `log` tier cannot fire.
 *   2. redact: true     — anything a JS engine echoed into an Error message
 *                         (V8 puts the first 10 chars of a failed JSON.parse
 *                         input there, and that input can be decrypted content)
 *                         is stripped at the logger's choke point.
 *
 * Background:
 * .agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md
 * .agents/issues/.open/2026-08-17-decrypt-error-messages-leak-ten-characters-of-plaintext.md
 */

export interface LogControl {
  enable: () => string;
  disable: () => string;
  status: () => string;
}

export const LOG_CONTROL_GLOBAL = 'quorumLogger';

const PROBE_MARKER = 'qlRedactionProbe';

/**
 * Proves the LINKED quorum-shared build actually redacts, instead of assuming it.
 *
 * ⚠️ This is not paranoia about our own code, it is about which build is on
 * disk. `package.json` depends on quorum-shared via `link:../quorum-shared`, a
 * filesystem link to a sibling checkout whose `dist/` is gitignored and built
 * by hand. Nothing in the deploy path verifies that sibling is on a commit
 * containing the redaction.
 *
 * If it is stale, `logger.configure({ redact: true })` is silently accepted —
 * the old config object just absorbs the extra key — and `createLogMethod`
 * never consults it. Logs then go out FULLY unredacted while `enable()` below
 * promises the opposite. That is worse than the pre-existing behaviour of
 * logging nothing at all, and nothing about it is visible.
 *
 * So: push a canary through the real logger and check it came out transformed.
 * Verifies behaviour, not a version string, which is the only check a stale
 * build cannot pass.
 */
const redactionIsActive = (): boolean => {
  const original = console.error;
  let seen = '';
  try {
    console.error = (...args: unknown[]) => {
      seen = args
        .map((a) =>
          a && typeof a === 'object' && 'message' in a
            ? String((a as { message: unknown }).message)
            : String(a)
        )
        .join(' ');
    };
    logger.error(new Error(`probe "${PROBE_MARKER}" end`));
  } catch {
    return false;
  } finally {
    console.error = original;
  }
  // Empty means nothing was logged at all, so nothing was proven either way.
  return seen !== '' && !seen.includes(PROBE_MARKER);
};

/** Exported for tests. Not part of the exposed global. */
export const __verifyRedactionForTests = redactionIsActive;

export const createLogControl = (): LogControl => ({
  enable: () => {
    // minLevel and redact are set TOGETHER and are not caller-configurable.
    // Opening the hatch without either one is the failure mode this prevents.
    logger.configure({ enabled: true, minLevel: 'warn', redact: true });

    if (!redactionIsActive()) {
      // Say so loudly rather than repeating a promise that is not being kept.
      // The likely cause is a stale linked quorum-shared build.
      logger.configure({ enabled: false });
      return [
        'Diagnostics NOT enabled — this build cannot redact message content.',
        'Enabling anyway could print parts of decrypted messages to the console,',
        'so it has been left off.',
        'If you are a developer: rebuild quorum-shared (yarn build) and reload.',
      ].join('\n');
    }

    return [
      'Diagnostics ON — warnings and errors only, message content excluded.',
      'Reproduce the problem, then copy the console output.',
      'Review it before sharing: it can still contain space and device identifiers.',
      `Turn it back off with ${LOG_CONTROL_GLOBAL}.disable()`,
    ].join('\n');
  },

  disable: () => {
    // redact is deliberately NOT reset. Leaving it on is harmless when logging
    // is off, and means a later re-enable cannot land in an unredacted state.
    logger.configure({ enabled: false });
    return 'Diagnostics OFF.';
  },

  status: () =>
    logger.isEnabled() ? 'Diagnostics are ON.' : 'Diagnostics are OFF.',
});

/**
 * Attaches the control to a global. Takes the target rather than reaching for
 * `window` so this is testable without a DOM.
 */
export const installLogControl = (target: Record<string, unknown>): void => {
  target[LOG_CONTROL_GLOBAL] = createLogControl();
};
