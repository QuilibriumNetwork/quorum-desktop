/**
 * The one sanctioned bypass of the QNS ownership check, and the gate that keeps
 * it out of production.
 *
 * The dev overlay synthesizes `primary_username` values so the whole family of
 * `.q` surfaces can be swept without registering real names. Those names are
 * registered nowhere, so genuine verification strips all of them and the
 * instrument goes inert — injecting names, having them removed, and rendering
 * exactly as it did before it existed. The exemption is what stops that.
 *
 * Which makes the exemption itself a live "render this unverified `.q`" path,
 * so the tests below care about two separate things:
 *
 *  1. it is unreachable outside a development build, and
 *  2. even inside one it is narrow — it exempts only names the overlay itself
 *     would produce for that exact address, never a real registration.
 *
 * ## What is asserted where
 *
 * These assert the RUNTIME gate. The complementary fact — that `fakeQnsCore` is
 * absent from a release bundle — is a build-time property that no unit test can
 * see, so do not add one that pretends to. It is enforced by two build guards.
 *
 * ⚠️ This header used to say the module is absent "because the folded condition
 * leaves it with no importer", verified by grepping `dist/` for dev identifiers.
 * Both halves were wrong, and together they hid a bug that shipped a blank app
 * on 2026-08-17. `web/vite.config.ts` marks `src/dev/` as `external` in a
 * production build; externalisation is decided at RESOLUTION time, before
 * tree-shaking, and an external module is preserved as a runtime import. So the
 * import survived, pointing at a file the same rule had excluded — and the
 * identifier grep reported a clean 0 precisely BECAUSE the module was external,
 * so none of its code was inlined. The instrument could not have caught it.
 *
 * `src/identity/qnsClaimExemption.ts` no longer imports this module at all; the
 * overlay registers its checker instead. The guards are:
 *   - `scripts/check-bundle-globals.mjs`      — dev IDENTIFIERS in the bundle
 *   - `scripts/check-bundle-dev-imports.mjs`  — dev IMPORTS in the bundle
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isExemptClaim,
  __resetExemptionCheckerForTests,
} from '@/identity/qnsClaimExemption';
import { isFakeClaimFor, deriveFakeQName } from '@/dev/fake-qns/fakeQnsCore';

const STORAGE_KEY = 'dev.fakeQns.state';
const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const OTHER = 'QmThemThemThemThemThemThemThemThemThemThemThem';

const setOverlay = (state: Record<string, unknown>) =>
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

const ORIGINAL_ENV = process.env.NODE_ENV;

beforeEach(() => globalThis.localStorage.clear());
afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
  globalThis.localStorage.clear();
});

describe('isExemptClaim — the production gate', () => {
  it('never exempts anything outside a development build', () => {
    // The overlay is fully enabled and WOULD say yes. The gate still says no.
    // This is the assertion that matters: everything else here is about
    // keeping a dev tool usable, this one is about not shipping a bypass.
    setOverlay({ enabled: true, giveEveryoneAName: true, entries: {} });
    const claim = deriveFakeQName(ADDR);

    expect(isFakeClaimFor(claim, ADDR)).toBe(true); // the overlay agrees...
    for (const env of ['production', 'test', undefined]) {
      process.env.NODE_ENV = env as string;
      expect(isExemptClaim(claim, ADDR)).toBe(false); // ...the gate refuses
    }
  });

  it('delegates to the overlay in a development build', () => {
    process.env.NODE_ENV = 'development';
    setOverlay({ enabled: true, giveEveryoneAName: true, entries: {} });
    expect(isExemptClaim(deriveFakeQName(ADDR), ADDR)).toBe(true);
  });
});

describe('isFakeClaimFor — narrowness', () => {
  it('exempts a derived name only for the address it was derived from', () => {
    setOverlay({ enabled: true, giveEveryoneAName: true, entries: {} });
    const claim = deriveFakeQName(ADDR);
    expect(isFakeClaimFor(claim, ADDR)).toBe(true);
    expect(isFakeClaimFor(claim, OTHER)).toBe(false);
  });

  it('exempts nothing while the overlay is off', () => {
    setOverlay({ enabled: false, giveEveryoneAName: true, entries: {} });
    expect(isFakeClaimFor(deriveFakeQName(ADDR), ADDR)).toBe(false);
  });

  it('exempts nothing derived while giveEveryoneAName is off', () => {
    setOverlay({ enabled: true, giveEveryoneAName: false, entries: {} });
    expect(isFakeClaimFor(deriveFakeQName(ADDR), ADDR)).toBe(false);
  });

  it('exempts an explicit entry, and only its exact name', () => {
    setOverlay({
      enabled: true,
      giveEveryoneAName: false,
      entries: { [ADDR.toLowerCase()]: { primaryUsername: 'deliberate' } },
    });
    expect(isFakeClaimFor('deliberate', ADDR)).toBe(true);
    expect(isFakeClaimFor('something-else', ADDR)).toBe(false);
  });

  it('does NOT exempt a real registration that merely passed through the overlay', () => {
    // The case that would hide the regression the instrument exists to catch.
    // An address with an explicit entry claiming a DIFFERENT name — a real one
    // the overlay left alone — must still face the genuine check.
    setOverlay({
      enabled: true,
      giveEveryoneAName: true,
      entries: { [ADDR.toLowerCase()]: { displayName: 'Someone' } },
    });
    expect(isFakeClaimFor('a-real-registered-name', ADDR)).toBe(false);
    // An explicit entry with no primaryUsername also suppresses the derived
    // name, so the overlay cannot exempt by two routes at once.
    expect(isFakeClaimFor(deriveFakeQName(ADDR), ADDR)).toBe(false);
  });

  it('exempts nothing for a blank name or address', () => {
    setOverlay({ enabled: true, giveEveryoneAName: true, entries: {} });
    expect(isFakeClaimFor('', ADDR)).toBe(false);
    expect(isFakeClaimFor('   ', ADDR)).toBe(false);
    expect(isFakeClaimFor(deriveFakeQName(ADDR), '')).toBe(false);
  });
});

describe('isExemptClaim — the registration seam', () => {
  afterEach(() => {
    // Re-register, so the reset below cannot leak into later tests in this file.
    setOverlay({ enabled: false });
  });

  it('returns false in development when the overlay has never registered', () => {
    // The state the dependency inversion introduced: production imports nothing
    // from src/dev/, so `checker` stays null. This must FAIL CLOSED. Before the
    // inversion this state could not exist, because the import was static.
    __resetExemptionCheckerForTests();
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      setOverlay({ enabled: true, giveEveryoneAName: true, entries: {} });
      expect(isExemptClaim(deriveFakeQName(ADDR), ADDR)).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
