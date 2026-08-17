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
 * release build the condition below folds to `false` and the call is dead code.
 *
 * A runtime flag would leave a live code path in production that returns "this
 * claim is fine, skip the check", which is precisely the thing verification
 * exists to make impossible.
 *
 * ## ⚠️ Why the overlay REGISTERS itself instead of being imported
 *
 * This module used to `import { isFakeClaimFor } from '../dev/fake-qns/…'`
 * directly, on the reasoning that the dead branch below would leave it with no
 * importer, so it would tree-shake away. That reasoning was wrong, and it
 * shipped a blank app.
 *
 * `web/vite.config.ts` marks everything under `src/dev/` as `external` in a
 * production build. Externalisation happens at RESOLUTION time, long before
 * tree-shaking gets a chance, and an external module is deliberately preserved
 * as a runtime import. So the "eliminated" import survived into the bundle as
 * `import"../src/dev/fake-qns/fakeQnsCore"`, pointing at a file that the very
 * same rule had excluded from the output. The browser 404'd it, the module
 * graph failed, and React never mounted.
 *
 * A static import cannot be made conditional, so the dependency is inverted
 * instead: production never names `src/dev/` at all, and the overlay hands its
 * checker in when it loads. `scripts/check-bundle-dev-imports.mjs` fails the
 * build if any `src/dev/` import reaches the bundle again.
 *
 * This is NOT a behaviour change. `isFakeClaimFor` reads `getFakeQnsState()`,
 * which lives inside the overlay module, and returns false unless the overlay
 * is enabled. "Checker not registered" and "overlay not loaded" are therefore
 * the same state, and the overlay cannot be enabled without being loaded — so
 * the unregistered answer (false) is the answer the old code gave too.
 */

type ExemptionChecker = (name: string, address: string) => boolean;

let checker: ExemptionChecker | null = null;

/**
 * Called by `src/dev/fake-qns/fakeQnsCore` at module load. Nothing in a
 * production build calls this, because nothing in a production build imports
 * that module.
 */
export function registerExemptionChecker(next: ExemptionChecker): void {
  checker = next;
}

/** Test seam. Production never reaches this. */
export function __resetExemptionCheckerForTests(): void {
  checker = null;
}

/**
 * True when `name` is a claim the dev overlay itself synthesized for `address`.
 *
 * Always false in production. Callers treat a true result as "verified", so
 * this must stay narrower than the overlay's own output: a REAL registration
 * passing through the overlay untouched is not exempt, because verifying real
 * names is the behaviour the overlay exists to observe.
 */
export function isExemptClaim(name: string, address: string): boolean {
  // Folds to `return false` in a release build, so the line below is dead code
  // and `checker` is unreachable regardless of what may have registered it.
  if (process.env.NODE_ENV !== 'development') return false;
  return checker ? checker(name, address) : false;
}
