import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@quilibrium/quorum-shared';
import {
  createLogControl,
  installLogControl,
  LOG_CONTROL_GLOBAL,
} from '../../../utils/productionLogControl';

const CANARY = 'CANARY-b7f3e9a1-TOP-SECRET-MESSAGE-BODY';

/** The V8 SyntaxError shape that carries echoed plaintext. */
const errorFromParsingDecryptedContent = (plaintext: string): Error => {
  try {
    JSON.parse(plaintext);
    throw new Error('fixture is wrong: JSON.parse was expected to throw');
  } catch (e) {
    return e as Error;
  }
};

describe('productionLogControl — the escape hatch', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;

  const serialise = (calls: unknown[][]) =>
    JSON.stringify(calls, (_k, v) =>
      // Error props are non-enumerable; without this, negative assertions pass
      // vacuously. See quorum-shared's logger.test.ts for how that bit once.
      v instanceof Error ? { name: v.name, message: v.message } : v
    );

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    // Simulate a production build: logging fully off, nothing redacted yet.
    logger.configure({ enabled: false, minLevel: 'log', redact: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.configure({ enabled: true, minLevel: 'log', redact: false });
  });

  it('CONTROL: before enabling, a production build logs nothing at all', () => {
    // If this ever fails, the starting state is wrong and every assertion
    // below is measuring something other than what it claims to.
    logger.error('e');
    logger.warn('w');
    logger.log('l');
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('enable() turns on warnings and errors', () => {
    createLogControl().enable();
    logger.warn('a warning');
    logger.error('an error');
    expect(warn).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it('enable() leaves the plaintext-printing log and debug tiers dark', () => {
    // THE critical safety property. logger.log is where the decrypted
    // TripleRatchet payload is printed, so it must not come back on.
    createLogControl().enable();
    logger.log('would print decrypted content');
    logger.debug('would print decrypted content');
    expect(log).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
  });

  it('enable() redacts plaintext echoed into an error message', () => {
    // The second, independent guarantee: even on a tier that IS on, engine-
    // echoed content is stripped.
    createLogControl().enable();
    logger.error('decrypt failed', errorFromParsingDecryptedContent(CANARY));
    expect(error).toHaveBeenCalled();
    expect(serialise(error.mock.calls)).not.toContain(CANARY.slice(0, 10));
  });

  it('disable() silences it again', () => {
    const control = createLogControl();
    control.enable();
    control.disable();
    logger.warn('w');
    logger.error('e');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('status() reports the current state', () => {
    const control = createLogControl();
    expect(control.status()).toContain('OFF');
    control.enable();
    expect(control.status()).toContain('ON');
  });

  it('installs under the documented global name', () => {
    const target: Record<string, unknown> = {};
    installLogControl(target);
    expect(target[LOG_CONTROL_GLOBAL]).toBeDefined();
  });

  it('does NOT expose the logger or a general configure()', () => {
    // Guards against someone widening this later. Exposing logger.enable()
    // directly would re-arm the log tier and defeat the whole design.
    const target: Record<string, unknown> = {};
    installLogControl(target);
    const exposed = target[LOG_CONTROL_GLOBAL] as Record<string, unknown>;
    expect(Object.keys(exposed).sort()).toEqual(['disable', 'enable', 'status']);
    expect(exposed.configure).toBeUndefined();
  });
});
