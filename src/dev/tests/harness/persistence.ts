// Message-level accounting: what the real code actually PERSISTED, by number.
//
// ── Why this is separate from frame counting ────────────────────────────────
//
// `loss.ts` answers "did the frame reach the peer's socket". That is a different
// question from "did the app keep the message", and conflating them is the single
// most expensive mistake this investigation has made. A frame can arrive, decrypt
// cleanly, and never reach `saveMessage` — invisible to every frame-level count.
//
// `dm-loss` reported 201/201 and 0% on the canonical accounts while the operator
// watched those same accounts' other devices receive ~10 of 200. It was not wrong;
// it was answering a different question.
//
// These helpers live here rather than inside one scenario because BOTH dm-loss and
// dm-multidevice need them, and a divergent copy of the gap-shape rule would be
// worse than no rule — two scenarios silently disagreeing about what "contiguous"
// means is exactly the kind of drift that costs a day.
import type { HarnessBot } from './bot';

/** Messages of a given text prefix this bot's real code actually persisted. */
export const postsMatching = (bot: HarnessBot, prefix: string) =>
  new Set(
    bot.captured
      .filter((m) => m.content?.type === 'post' && (m.content.text ?? '').startsWith(prefix))
      .map((m) => m.content?.text as string)
  );

/** The numbered messages of `prefix` this bot persisted. */
export function persistedNumbers(bot: HarnessBot, prefix: string): Set<number> {
  const got = new Set<number>();
  for (const text of postsMatching(bot, prefix)) {
    const n = Number(/#(\d+)$/.exec(text)?.[1]);
    if (Number.isFinite(n)) got.add(n);
  }
  return got;
}

/**
 * WHICH numbered messages are missing, not just how many.
 *
 * The count alone cannot separate two very different bugs, and the first
 * multi-device run produced exactly that ambiguity: one device persisted 52 of
 * 100 in BOTH directions while every frame arrived and nothing failed to decrypt.
 *
 *   a contiguous TAIL missing  ⇒ the device stopped processing at some moment
 *                                (a receive-pipeline stall)
 *   SCATTERED gaps             ⇒ per-message drops
 *   every OTHER one            ⇒ something in dedupe/ordering
 *
 * Those need different investigations, so the run has to say which it is. The
 * fault-injected runs of 2026-07-29 confirmed the tail shape means a stall: every
 * gap was contiguous while a slow `/inbox/delete` head-of-line blocked the inbox,
 * and all of them vanished once the handler stopped awaiting the relay.
 */
export function missingReport(bot: HarnessBot, prefix: string, rounds: number): string {
  const got = persistedNumbers(bot, prefix);
  const missing: number[] = [];
  for (let i = 1; i <= rounds; i++) if (!got.has(i)) missing.push(i);
  if (missing.length === 0) return 'none';

  // Contiguous tail? i.e. everything from some point on is absent.
  const isTail =
    missing[missing.length - 1] === rounds && missing.length === rounds - missing[0] + 1;
  const shape = isTail
    ? `CONTIGUOUS TAIL from #${missing[0]} — looks like the device STOPPED`
    : `scattered (${missing.length} gaps, first #${missing[0]}, last #${missing[missing.length - 1]})`;
  const sample = missing.slice(0, 24).join(',') + (missing.length > 24 ? ',…' : '');
  return `${shape}  missing=[${sample}]`;
}
