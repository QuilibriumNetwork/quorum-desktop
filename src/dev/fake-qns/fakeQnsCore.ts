/**
 * fakeQns — dev-only synthesis of QNS `.q` names and public profiles.
 *
 * WHY THIS EXISTS. A `.q` name travels in exactly one place: the published
 * public profile. So to see where a `.q` renders you need an account that owns
 * a registered QNS name, has elected it primary, and has a public profile — and
 * so does whoever you are looking at. On a test account with no name, every QNS
 * surface in the app is unreachable, which means the tier that outranks a
 * user's display name everywhere can regress silently and no amount of using
 * the app would show it.
 *
 * This fakes the one thing that is expensive to obtain (a registered name) and
 * nothing else. It intercepts the READ of a public profile and hands back a
 * synthesized one. Nothing is written, nothing is signed, nothing leaves the
 * machine.
 *
 * ## This is the deliberate replacement for the hand-editing recipe
 *
 * `.agents/docs/features/qns-username-display.md` used to describe smoke-testing
 * this by temporarily editing a `primary_username` into the public-profile
 * `queryFn` — and warned that you had to patch EVERY hook writing
 * `publicProfileQueryKey`, because they share one cache entry and whichever
 * resolves first wins. Miss one and it caches a real `null`, the patched ones
 * never run, and the fake silently never appears.
 *
 * Injecting inside `QuorumApiClient.getPublicProfile` makes that unreachable by
 * construction: there is no second path to a public profile, so there is no
 * hook to forget, and nothing has to be reverted before committing.
 *
 * ## Kept deliberately identical to mobile's `services/dev/fakeQns.ts`
 *
 * Same state shape, same precedence, same derived names. The point of the tool
 * is comparing what the two clients render for the same member — which only
 * means anything if both were handed the same input. If you change the rules
 * here, change them there.
 *
 * ## What a green run does and does not prove
 *
 * Everything downstream of the network is real: the merge, the resolver, the
 * render. Publishing, the signature payload and the server are not exercised.
 */

import { registerExemptionChecker } from '../../identity/qnsClaimExemption';

const STORAGE_KEY = 'dev.fakeQns.state';

/** The public-profile shape, kept structural so this never has to import from
 *  the API layer it is injected into. */
export interface FakeablePublicProfile {
  display_name: string;
  profile_image: string;
  bio: string;
  primary_username?: string;
  timestamp: number;
  signature: string;
}

/** A deliberate, per-address override. Use for precedence tests where two
 *  members must differ; `giveEveryoneAName` covers the "where does it render"
 *  sweep on its own. */
export interface FakeQnsEntry {
  /** The bare `.q` name, no suffix (`alice` renders as `alice.q`). */
  primaryUsername?: string;
  /** Global display name. Set it to something recognisably different from the
   *  `.q` to prove which tier won. */
  displayName?: string;
  /** Treat this address as having no public profile at all — the same thing the
   *  viewer sees when someone leaves their profile private. */
  private?: boolean;
}

export interface FakeQnsState {
  /** Master switch. Off means this module is inert. */
  enabled: boolean;
  /** Synthesize a `.q` for every address with no explicit entry, derived from
   *  the address so it is stable across reloads. */
  giveEveryoneAName: boolean;
  /** Return "no public profile" for every address. Answers the question the
   *  public/private toggle raises: what does someone who messages you see when
   *  your profile is private? */
  allProfilesPrivate: boolean;
  /** Per-address overrides, keyed by lowercased address. */
  entries: Record<string, FakeQnsEntry>;
}

const DEFAULT_STATE: FakeQnsState = {
  enabled: false,
  giveEveryoneAName: false,
  allProfilesPrivate: false,
  entries: {},
};

/** localStorage rather than IndexedDB: the overlay is consulted on a synchronous
 *  path inside the API client, and a dev flag is not worth an async read. */
function readRaw(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function getFakeQnsState(): FakeQnsState {
  const raw = readRaw();
  if (raw == null) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<FakeQnsState>;
    return {
      enabled: parsed.enabled === true,
      giveEveryoneAName: parsed.giveEveryoneAName === true,
      allProfilesPrivate: parsed.allProfilesPrivate === true,
      entries:
        parsed.entries && typeof parsed.entries === 'object'
          ? parsed.entries
          : {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function setFakeQnsState(next: Partial<FakeQnsState>): FakeQnsState {
  const merged = { ...getFakeQnsState(), ...next };
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Non-fatal: the panel reads back what it just set from the returned value.
  }
  return merged;
}

export function setFakeQnsEntry(
  address: string,
  entry: FakeQnsEntry
): FakeQnsState {
  const state = getFakeQnsState();
  return setFakeQnsState({
    entries: { ...state.entries, [address.toLowerCase()]: entry },
  });
}

export function removeFakeQnsEntry(address: string): FakeQnsState {
  const { [address.toLowerCase()]: _removed, ...rest } =
    getFakeQnsState().entries;
  return setFakeQnsState({ entries: rest });
}

export function clearFakeQns(): FakeQnsState {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal, as above.
  }
  return DEFAULT_STATE;
}

/**
 * A stable, obviously-fake `.q` derived from an address.
 *
 * Deterministic so the same member keeps the same name across reloads — a name
 * that changed every render would make it impossible to tell "this surface
 * re-resolved" from "this surface shows a different person". Prefixed `qa` so
 * nothing on screen can be mistaken for a real registration.
 *
 * Must stay byte-identical to mobile's, or the same member gets two different
 * synthetic names on the two clients and the parity comparison is meaningless.
 */
export function deriveFakeQName(address: string): string {
  const entropy = (address.startsWith('Qm') ? address.slice(2) : address)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return `qa${entropy.slice(0, 4) || '0000'}`;
}

/**
 * Is this claim one THIS overlay synthesized for THIS address?
 *
 * Exists because claim verification would otherwise make the whole instrument
 * inert. A synthesized name (`qa1234`) is registered nowhere, so the genuine
 * ownership check strips every one of them: the overlay would inject names, the
 * verifier would remove them, and every QNS surface would render exactly as it
 * did before the overlay existed — the panel reporting success while showing
 * nothing. That failure looks identical to "the feature is broken", which is
 * the most expensive kind of dev-tool bug.
 *
 * Deliberately narrow. It exempts ONLY names this module would itself produce
 * for that exact address:
 *
 * - an explicit entry's `primaryUsername`, which is a deliberate act, and
 * - the derived `qa…` name, and only while `giveEveryoneAName` is on.
 *
 * A REAL registration that happens to pass through `applyFakeQns` untouched is
 * NOT exempt, and must not be: verifying real names is the one behaviour the
 * instrument exists to observe, so exempting them would hide the regression it
 * was built to catch.
 *
 * ⚠️ There is no production path to this, and the reason is NOT the one this
 * comment used to give. It used to say that `identity/qnsClaimExemption.ts`
 * imports this module behind a `process.env.NODE_ENV` gate, so the call becomes
 * dead code and the module "loses its last importer" and tree-shakes away.
 * That reasoning shipped a blank app on 2026-08-17: `web/vite.config.ts` marks
 * `src/dev/` as `external` in a production build, externalisation is decided at
 * RESOLUTION time long before tree-shaking, and an external module is preserved
 * as a runtime import. The import survived pointing at a file the same rule had
 * excluded, so the browser 404'd it and React never mounted.
 *
 * The dependency is now inverted: nothing in production names this module.
 * This file calls `registerExemptionChecker` at load (see the bottom of this
 * file), so `isExemptClaim` reaches this function only when the overlay has
 * actually been loaded — which only happens in a dev build.
 *
 * Three independent checks, because no one of them is sufficient:
 *   - `src/dev/tests/identity/qnsClaimExemption.test.ts` asserts the RUNTIME
 *     gate refuses outside development.
 *   - `scripts/check-bundle-globals.mjs` fails the build if dev IDENTIFIERS
 *     reach the bundle.
 *   - `scripts/check-bundle-dev-imports.mjs` fails the build if a dev IMPORT
 *     survives. This is the one that would have caught the blank page; the
 *     identifier grep could not, because externalisation strips the identifiers
 *     while leaving the dangling import.
 *
 * Anything that made this reachable in production would be a way to render an
 * unverified `.q`, which is the entire thing verification prevents.
 */
export function isFakeClaimFor(name: string, address: string): boolean {
  const claim = (name ?? '').trim();
  const addr = (address ?? '').trim();
  if (!claim || !addr) return false;

  const state = getFakeQnsState();
  if (!state.enabled) return false;

  const entry = state.entries[addr.toLowerCase()];
  if (entry) return !!entry.primaryUsername && entry.primaryUsername === claim;

  return state.giveEveryoneAName && deriveFakeQName(addr) === claim;
}

/**
 * The seam. Called from `QuorumApiClient.getPublicProfile` with whatever the
 * server actually returned, or `null` for a 404.
 *
 * Returning a synthesized profile for a `null` is the important case, not an
 * edge one: a test account's spacemates typically have no public profile at
 * all, so an overlay that only decorated existing profiles would decorate
 * nothing and appear inert.
 */
export function applyFakeQns(
  address: string,
  actual: FakeablePublicProfile | null
): FakeablePublicProfile | null {
  const state = getFakeQnsState();
  if (!state.enabled) return actual;

  if (state.allProfilesPrivate) return null;

  const entry = state.entries[address.toLowerCase()];
  if (entry?.private) return null;

  // Never fake over a real registration. If someone genuinely published a `.q`,
  // the sweep must leave it visible — otherwise the one case the instrument
  // exists to observe would be the one case it hides, and a real regression
  // would be masked by a synthetic pass. An explicit entry still wins, because
  // that is a deliberate act rather than a blanket rule.
  const realQns = actual?.primary_username;
  const primaryUsername =
    entry?.primaryUsername ||
    realQns ||
    (entry
      ? undefined
      : state.giveEveryoneAName
        ? deriveFakeQName(address)
        : undefined);
  const displayName = entry?.displayName;

  if (!primaryUsername && !displayName) return actual;

  return {
    display_name: displayName || actual?.display_name || '',
    profile_image: actual?.profile_image ?? '',
    bio: actual?.bio ?? '',
    ...(primaryUsername ? { primary_username: primaryUsername } : {}),
    // Now, so a faked global name outranks whatever the roster's global slot
    // holds. The merge in useVisibleSenderProfileFallback picks the newer
    // of the two by timestamp, so a stale one here would silently lose and the
    // fake would look broken.
    timestamp: Date.now(),
    signature: actual?.signature ?? '',
  };
}

// Hand the exemption checker to src/identity/qnsClaimExemption at module load.
//
// The dependency points THIS way on purpose. Production code must never name a
// module under src/dev/: web/vite.config.ts externalises this directory in a
// release build, and an external import is preserved as a runtime fetch for a
// file that is not in the output. When qnsClaimExemption imported this module
// directly, that dangling import 404'd and the whole app failed to mount.
//
// Registering here costs nothing: this module only loads in a dev build, and
// the overlay cannot be enabled without it being loaded, so an unregistered
// checker and a disabled overlay mean the same thing.
registerExemptionChecker(isFakeClaimFor);
