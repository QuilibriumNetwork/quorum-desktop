/**
 * DM Doctor — resident warning counters.
 *
 * Wraps console.log/warn/error/info (dev builds only) to count the three
 * receive-path warnings that are the tell-tale signs of the DM-loss bugs this
 * tool exists to surface:
 *   - "SESSION REPLACED by init envelope"  (src/services/MessageService.ts)
 *   - "DM frame for unknown inbox"          (src/services/MessageService.ts)
 *   - /decrypt/i AND /fail|error|unable/i together
 *
 * Ports the exact matching logic of the checked-in console probe
 * (`.agents/tools/dm-debug/07-receiver-probe.js`).
 *
 * `@quilibrium/quorum-shared`'s `logger.warn/error/...` look up `console[level]`
 * fresh on every call (see quorum-shared/src/utils/logger.ts:
 * `createLogMethod` — `(...args) => { if (shouldLog(level)) console[level](...args); }`),
 * so wrapping `console[name]` here catches every call through `logger` too,
 * regardless of install order.
 *
 * SECURITY / zero production footprint: this file lives under `src/dev/`, which
 * `web/vite.config.ts`'s `rolldownOptions.external` excludes from production
 * builds outright (any module path containing `/src/dev/` is externalized when
 * `NODE_ENV === 'production'`). The throw below is the same defence-in-depth
 * `dbDumpUtil.ts` uses: this module must never be *imported* in a production
 * build, and the one call site that imports it (`web/main.tsx`) only does so
 * inside a `process.env.NODE_ENV === 'development'` guard — mirroring the
 * `lazyDevImport` pattern `Router.web.tsx` uses for every other dev route, so
 * the import is dead-code-eliminated (not just runtime-skipped) in production.
 */

// Safety check - this module should never be imported in production builds.
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
  throw new Error(
    'dm-doctor/warningCounters should not be imported in production builds'
  );
}

export type DmWarningKey = 'sessionReplaced' | 'unknownInbox' | 'decryptFailish';

export interface DmWarningCounterState {
  installedAt: string | null;
  counts: Record<DmWarningKey, number>;
  /** Most recent occurrence first, capped at 5, ISO timestamps. */
  lastHits: Record<DmWarningKey, string[]>;
}

const MATCHERS: Array<[DmWarningKey, (s: string) => boolean]> = [
  ['sessionReplaced', (s) => s.includes('SESSION REPLACED by init envelope')],
  ['unknownInbox', (s) => s.includes('DM frame for unknown inbox')],
  ['decryptFailish', (s) => /decrypt/i.test(s) && /fail|error|unable/i.test(s)],
];

const MAX_LAST_HITS = 5;

const state: DmWarningCounterState = {
  installedAt: null,
  counts: { sessionReplaced: 0, unknownInbox: 0, decryptFailish: 0 },
  lastHits: { sessionReplaced: [], unknownInbox: [], decryptFailish: [] },
};

let installed = false;

/**
 * Install the console wrap. Idempotent — safe to call more than once (e.g. if
 * both the startup import and a page mount race), only the first call wraps
 * console and resets the install timestamp.
 */
export function installDmWarningCounters(): DmWarningCounterState {
  if (installed) return getDmWarningState();
  if (typeof console === 'undefined') return getDmWarningState();

  installed = true;
  state.installedAt = new Date().toISOString();

  (['log', 'warn', 'error', 'info'] as const).forEach((name) => {
    const original = console[name].bind(console);
    console[name] = (...args: unknown[]) => {
      try {
        const text = args
          .map((arg) => (typeof arg === 'string' ? arg : ''))
          .join(' ');
        for (const [key, test] of MATCHERS) {
          if (!test(text)) continue;
          state.counts[key]++;
          const hits = state.lastHits[key];
          hits.unshift(new Date().toISOString());
          if (hits.length > MAX_LAST_HITS) hits.length = MAX_LAST_HITS;
        }
      } catch {
        // Instrumentation must never break real logging.
      }
      original(...args);
    };
  });

  if (typeof window !== 'undefined') {
    (window as unknown as { __dmWarningCounters: () => DmWarningCounterState }).__dmWarningCounters =
      getDmWarningState;
  }

  return getDmWarningState();
}

/** Read-only snapshot of the current counter state. */
export function getDmWarningState(): DmWarningCounterState {
  return {
    installedAt: state.installedAt,
    counts: { ...state.counts },
    lastHits: {
      sessionReplaced: [...state.lastHits.sessionReplaced],
      unknownInbox: [...state.lastHits.unknownInbox],
      decryptFailish: [...state.lastHits.decryptFailish],
    },
  };
}

/** Test-only: reset install state so a fresh test can call install again. */
export function __resetForTests(): void {
  installed = false;
  state.installedAt = null;
  (Object.keys(state.counts) as DmWarningKey[]).forEach((key) => {
    state.counts[key] = 0;
    state.lastHits[key] = [];
  });
}
