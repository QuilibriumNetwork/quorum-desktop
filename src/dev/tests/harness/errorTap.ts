// Attribute a service-layer failure to the bot whose frame caused it, without
// mutating global state per frame.
//
// ⚠️ WHY THIS EXISTS — the obvious implementation is broken, and it was shipped.
//
// The space receive path never propagates a failure: the whole hub/sync branch
// ends in one terminal catch (`MessageService.ts:6110`) that swallows the error
// and reports it via `console.error`. The DM path uses `logger.error`. So the
// only way to observe a failure from outside is to tee those two sinks.
//
// The obvious way to tee them is to save/patch/restore around each frame. With
// ONE bot that works. With two, it silently corrupts the exact number this
// harness exists to produce, because `logger` and `console` are process-wide
// singletons and `WsTransport.dispatch` serialises frames only WITHIN one bot:
//
//   A installs teeA           (saved orig = REAL)
//   A awaits handleNewMessage
//   B installs teeB           (saved orig = teeA, not REAL)
//   B awaits handleNewMessage
//   A finishes → restores REAL, silently removing teeB while B is still running
//                → a real failure of B's now reaches nobody: UNDER-count
//   B finishes → restores teeA, a dead closure from A's finished frame
//                → logger.error stays patched forever, for every later test in
//                  this worker: PERMANENT under-count
//
// and in the nested window, a failure caused by A's frame is seen by teeB too,
// so it lands in B's count as well: OVER-count and misattribution.
//
// Three independent reviewers found this. It is the same class of defect as the
// one already fixed on this branch (a counter that cannot fire) — a counter that
// fires for the wrong bot, or stops firing entirely, is not better.
//
// THE FIX: install the tee EXACTLY ONCE and never restore it, then attribute by
// async context instead of by wall-clock nesting. `AsyncLocalStorage` propagates
// through every await inside `handleNewMessage`, so an error logged deep in the
// service is attributed to whichever bot's `runAttributed` frame is on the stack
// — correctly, no matter how the two bots interleave.
import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from '@quilibrium/quorum-shared';

/** Where an attributed failure is recorded. One per in-flight frame. */
export interface FailureSink {
  record: (message: string) => void;
  /**
   * Optional: receive EVERY `logger.log` line emitted while this sink is
   * current, not only failures.
   *
   * This is what turns "the roster did not arrive" into "the handshake died at
   * step 4, and here is by how many milliseconds". The sync path is already
   * densely logged by the real services — `sync-request: Expired, ignoring`,
   * `initiateSync: No suitable candidates`, `member delta: … resolved=N` — and
   * in a browser those lines are trapped behind DevTools and a human reading
   * them. In-process they are data.
   */
  trace?: (line: string) => void;
}

const store = new AsyncLocalStorage<FailureSink>();

// Matched against the FIRST argument of the log call.
//
// Kept deliberately short. An earlier version listed 'TripleRatchetDecrypt
// failed', 'UnsealSyncEnvelope' and 'UnsealHubEnvelope' — none of which can ever
// match, because every space/sync exception funnels through the single catch at
// `MessageService.ts:6110` whose first argument is always the fixed string
// below; the underlying cause only ever appears as the SECOND argument. Listing
// markers that cannot fire implies a classification granularity this instrument
// does not have.
const FAILURE_MARKERS = [
  'Error processing hub/sync message', // MessageService.ts:6110 — the space branch
  'DM decrypt failed', // the DM branch, for a bot that does both
];

function isFailure(first: string): boolean {
  return FAILURE_MARKERS.some((m) => first.includes(m));
}

let installed = false;

/**
 * Install the permanent tee. Idempotent, and never uninstalled — that is the
 * point. Calls outside any `runAttributed` scope pass straight through.
 */
export function installErrorTap(): void {
  if (installed) return;
  installed = true;

  const wrap =
    (orig: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      const sink = store.getStore();
      if (sink) {
        const first = String(args[0] ?? '');
        // The cause is args[1]; carry it, since args[0] is a fixed string and
        // on its own says nothing about what actually failed.
        if (isFailure(first))
          sink.record(`${first} ${String(args[1] ?? '')}`.trim());
      }
      return orig(...args);
    };

  const loggerRef = logger as unknown as {
    error: (...a: unknown[]) => unknown;
    log: (...a: unknown[]) => unknown;
  };
  loggerRef.error = wrap(loggerRef.error.bind(logger));
  console.error = wrap(console.error.bind(console)) as typeof console.error;

  // The trace tap. Same discipline as above — installed once, never restored,
  // attributed by async context — because a per-frame patch/restore of a global
  // is the bug this module exists to avoid.
  const origLog = loggerRef.log.bind(logger);
  loggerRef.log = (...args: unknown[]) => {
    const sink = store.getStore();
    if (sink?.trace) {
      sink.trace(
        args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ')
      );
    }
    return origLog(...args);
  };
}

/** Run `fn` with failures attributed to `sink`. */
export function runAttributed<T>(
  sink: FailureSink,
  fn: () => Promise<T>
): Promise<T> {
  installErrorTap();
  return store.run(sink, fn);
}
