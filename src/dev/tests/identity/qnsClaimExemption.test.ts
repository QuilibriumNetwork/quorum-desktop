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
 * These assert the RUNTIME gate. The complementary fact — that
 * `fakeQnsCore` is absent from a release bundle entirely, because the folded
 * condition leaves it with no importer — is a build-time property, MEASURED by
 * grepping `dist/` after `yarn build` (0 occurrences of `deriveFakeQName`,
 * `isFakeClaimFor`, `applyFakeQns` or the storage key, across 71 bundle files,
 * on 2026-08-16). A unit test cannot see that, so do not add one that pretends
 * to; re-run the grep if the gate's shape ever changes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isExemptClaim } from '@/identity/qnsClaimExemption';
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
