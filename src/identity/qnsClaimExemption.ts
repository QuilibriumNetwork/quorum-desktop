/**
 * The one sanctioned way a `.q` renders without passing the ownership check,
 * and it exists only in dev builds.
 *
 * The dev QNS overlay (`src/dev/fake-qns/`) synthesizes `primary_username`
 * values so the whole family of `.q` surfaces can be swept without registering
 * real names. Those synthetic names are registered nowhere, so genuine
 * verification strips every one of them — the overlay would inject names, the
 * verifier would remove them, and every surface would render exactly as it did
 * before the overlay existed. The panel would report success while showing
 * nothing, which is indistinguishable from the feature being broken.
 *
 * ## Why a `NODE_ENV` gate and not a runtime flag
 *
 * `process.env.NODE_ENV` is replaced with a literal at build time, so in a
 * release build the condition below folds to `false`, the call is dead code,
 * and `fakeQnsCore` has no remaining importer and drops out of the bundle. That
 * is asserted, not assumed — see `qnsClaimExemption.test.ts`.
 *
 * A runtime flag would leave a live code path in production that returns "this
 * claim is fine, skip the check", which is precisely the thing verification
 * exists to make impossible.
 */

import { isFakeClaimFor } from '../dev/fake-qns/fakeQnsCore';

/**
 * True when `name` is a claim the dev overlay itself synthesized for `address`.
 *
 * Always false in production. Callers treat a true result as "verified", so
 * this must stay narrower than the overlay's own output: a REAL registration
 * passing through the overlay untouched is not exempt, because verifying real
 * names is the behaviour the overlay exists to observe.
 */
export function isExemptClaim(name: string, address: string): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  return isFakeClaimFor(name, address);
}
