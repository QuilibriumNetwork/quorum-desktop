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
    // holds. The merge in useMembersWithPublicProfileFallback picks the newer
    // of the two by timestamp, so a stale one here would silently lose and the
    // fake would look broken.
    timestamp: Date.now(),
    signature: actual?.signature ?? '',
  };
}
