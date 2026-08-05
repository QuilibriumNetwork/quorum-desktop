// Records any write of a NON-EMPTY per-space override onto the local user's own
// member row. Only the Space Settings editor should ever do that; anything else
// appearing here is a regression.
//
// A tripwire, not a gate: it never blocks a write. `console.warn`, not `logger`,
// because logger calls compile to no-ops in production builds.
//
// Read it with:  JSON.parse(localStorage.getItem('quorum:diag:selfOverrideWrites'))

export const TRIPWIRE_KEY = 'quorum:diag:selfOverrideWrites';
export const MAX_TRIPWIRE_ENTRIES = 50;

export interface SelfOverrideWrite {
  at: number;
  spaceId: string;
  value: string;
  stack: string;
}

export function recordSelfOverrideWrite(input: {
  spaceId: string;
  value: string;
}): void {
  // '' is the deliberate clear — the fix, not the bug. Only non-empty is news.
  if (!input.value) return;
  try {
    const entry: SelfOverrideWrite = {
      at: Date.now(),
      spaceId: input.spaceId,
      value: input.value,
      stack: new Error().stack ?? '(no stack)',
    };
    const next = [...readSelfOverrideTripwire(), entry].slice(-MAX_TRIPWIRE_ENTRIES);
    localStorage.setItem(TRIPWIRE_KEY, JSON.stringify(next));
    console.warn(
      `[SelfOverride] a non-empty per-space override was written onto our OWN row ` +
        `for space ${input.spaceId.slice(0, 12)}. Only Space Settings → Account ` +
        `should do this. See ${TRIPWIRE_KEY} in localStorage.`,
      entry.stack
    );
  } catch {
    // Diagnostics must never break a write.
  }
}

export function readSelfOverrideTripwire(): SelfOverrideWrite[] {
  try {
    const raw = localStorage.getItem(TRIPWIRE_KEY);
    return raw ? (JSON.parse(raw) as SelfOverrideWrite[]) : [];
  } catch {
    return [];
  }
}
