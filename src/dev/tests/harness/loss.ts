// Send-vs-arrive accounting, shared by every scenario that measures delivery.
//
// Extracted from dm-loss so `dm-multidevice` reuses the SAME join rather than
// growing a second implementation. That matters more than it looks: raw frame
// counters have overstated volume by 2-5x three separate times in this
// investigation, and every one of those corrections is baked into the
// de-duplication below. A parallel counter would have to relearn them.
//
// The join is per (sender, receiver) PAIR, which is exactly what makes per-device
// accounting possible: call it once per receiving device instead of once per
// account, and each device's arrivals are measured on their own.
import type { HarnessBot } from './bot';
import { WsTransport } from './transport';

/**
 * Inbox addresses a bot is actually listening on — the only place a frame CAN
 * land for it. A frame addressed anywhere else is fan-out to some other device,
 * not loss, and counting it as loss is the single easiest way to make this bench
 * lie.
 */
export async function subscribedInboxes(bot: HarnessBot): Promise<Set<string>> {
  const states = await bot.messageDB.getAllEncryptionStates();
  return new Set([bot.identity.inboxAddress, ...states.map((s) => s.inboxId)]);
}

export interface DirectionResult {
  sent: number;
  arrived: number;
  missing: number;
  lossPct: number;
  /** Frames the receiver got that this sender never recorded sending to it. */
  unmatchedArrivals: number;
  /** Fingerprints that never arrived — for reporting WHICH ones, not just how many. */
  missingFps: string[];
}

/**
 * Frames `from` addressed to an inbox `to` is subscribed to, joined against what
 * `to`'s socket actually produced. Both sides de-duplicated by ciphertext
 * fingerprint first: un-acked frames are redelivered on every `listen`.
 */
export function direction(
  from: HarnessBot,
  to: HarnessBot,
  toInboxes: Set<string>
): DirectionResult {
  const sent = new Map<string, number>();
  for (const s of from.transport.sent) {
    if (!s.fp) continue;
    if (s.target && !toInboxes.has(s.target)) continue; // fan-out elsewhere, not loss
    if (!sent.has(s.fp)) sent.set(s.fp, s.t);
  }
  const arrived = new Set<string>();
  for (const f of to.transport.arrived) {
    const fp = WsTransport.ciphertextFp(f);
    if (fp) arrived.add(fp);
  }
  const missingFps = [...sent.keys()].filter((fp) => !arrived.has(fp));
  return {
    sent: sent.size,
    arrived: [...sent.keys()].filter((fp) => arrived.has(fp)).length,
    missing: missingFps.length,
    lossPct: sent.size ? (missingFps.length / sent.size) * 100 : 0,
    unmatchedArrivals: [...arrived].filter((fp) => !sent.has(fp)).length,
    missingFps,
  };
}
