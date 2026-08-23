// SLICE S1 — two bots in one space. The make-or-break slice.
//
//   yarn harness space-basic
//
// Bot A creates a space and posts. Bot B joins via a real invite link and must
// end up with BOTH halves of what joining is supposed to give you:
//
//   1. A's post              — the message half of the sync exchange
//   2. A's member row        — the ROSTER half, one payload, no retry
//
// The second one is why this scenario exists in this shape. The spec's S1 asked
// only for the post; `2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md`
// under .agents/issues/ is about the roster, and its §0 says the exchange is
// INTERMITTENT — it worked once (`memberDelta=71 members → saved 71 member
// row(s)`) and failed repeatedly around it. A joiner with 2 members is the
// smallest possible instance of "78 rows on one side, 1 on the other".
//
// ⚠️ This scenario answers "can it work at all", not "how often". One green run
// is not a rate and must not be quoted as one — three confident wrong answers in
// this investigation came from promoting a short streak to a law. The rate is
// slice S2's job.
//
// Timeline, and why in this order:
//   A creates → A posts #1        (pre-join history: reachable ONLY by sync)
//   B joins                       (joinInviteLink fires requestSync itself)
//   A posts #2                    (live broadcast: reachable without sync)
//   sample both sides every 2s until both halves land or the window closes
//
// Splitting the posts that way separates two mechanisms that a single post
// would conflate. If #2 lands and #1 never does, the hub broadcast works and the
// sync exchange does not — a materially different finding from both failing.
import { test, expect } from 'vitest';
import { createSpaceBot, type HarnessSpaceBot } from './spaceBot';
import { RunLog } from './log';

const WINDOW_MS = Number(process.env.HARNESS_SPACE_WINDOW_MS ?? 120_000);
const SAMPLE_MS = Number(process.env.HARNESS_SPACE_SAMPLE_MS ?? 2000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function postTexts(bot: HarnessSpaceBot): string[] {
  return bot.captured
    .filter((m) => m.content?.type === 'post')
    .map((m) => (m.content as { text?: string }).text ?? '');
}

test(
  "space-basic: B joins A's space and receives both A's post and A's member row",
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-basic', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[space-basic] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    // This previously minted fresh throwaway accounts every run, on the reasoning
    // that a reused bot would still hold the member row and the message from a
    // previous run and so "pass" without any exchange happening. That premise no
    // longer holds: `storage.ts` backs MessageDB with in-memory fake-indexeddb,
    // so both bots start from an empty database on every run regardless of name.
    // Both assertions below are also scoped to THIS run independently of that:
    // `bMembers` counts rows for a spaceId created moments ago, and the posts
    // carry `stamp` in their text.
    //
    // The identity is what must stay fixed: a new name mints a permanent account
    // on the relay, and there is no endpoint to delete one. Per-run uniqueness
    // still comes from `stamp`, which is in the space name and message text.
    //
    // ⚠️ NOT YET FALSIFIED under these fixed names. The reasoning above is READ,
    // not MEASURED — nobody has broken the join path and watched this arm go red
    // since the change. Tracked in
    // `.agents/issues/2026-08-23-harness-mints-permanent-accounts-every-run.md`.
    // An earlier version of this comment asserted the falsification had been
    // done. It had not, and that claim is exactly the failure mode this file's
    // header warns about — do not restore it without doing the run.
    const [a, b] = await Promise.all([
      createSpaceBot('space-basic-a'),
      createSpaceBot('space-basic-b'),
    ]);
    await Promise.all([a.drainInbox(), b.drainInbox()]);
    await Promise.all([a.start(), b.start()]);

    // Everything from here runs inside try/finally. Without it, ANY early throw
    // — a failed expect, a transient relay 5xx inside createSpace/join/post —
    // skips stop() and leaks a live production WebSocket plus the ActionQueue's
    // 1s interval, per bot, for the rest of the worker process. At S2 volume the
    // iterations most likely to throw are exactly the interesting ones.
    try {
      say(
        `A=${a.identity.address.slice(0, 12)}  B=${b.identity.address.slice(0, 12)}`,
        {
          a: a.identity.address,
          b: b.identity.address,
        }
      );

      b.onMember = (w) =>
        log.add(w.t, 'b', 'member', { user: w.userAddress?.slice(0, 12) });
      b.onDecrypted = (m) => {
        if (m.content?.type === 'post') {
          log.add(Date.now(), 'b', 'recv', {
            text: (m.content as { text?: string }).text,
          });
        }
      };

      // ── A creates the space and posts BEFORE B exists in it ──────────────────
      const { spaceId, channelId } = await a.createSpace(`harness-s1-${stamp}`);
      say(`space=${spaceId.slice(0, 12)} channel=${channelId.slice(0, 12)}`, {
        spaceId,
        channelId,
      });

      const preJoinText = `A pre-join #1 ${stamp}`;
      await a.post(spaceId, channelId, preJoinText);
      say(`A posted (pre-join): "${preJoinText}"`);

      // ── B joins ──────────────────────────────────────────────────────────────
      const link = await a.inviteLink(spaceId);
      const joined = await b.join(link);
      expect(joined.spaceId).toBe(spaceId);
      say(
        `B joined; B member rows=${await b.members(spaceId)} A member rows=${await a.members(spaceId)}`
      );

      // ── A posts again, now that B is a member ────────────────────────────────
      const postJoinText = `A post-join #2 ${stamp}`;
      await a.post(spaceId, channelId, postJoinText);
      say(`A posted (post-join): "${postJoinText}"`);

      // ── Sample until both halves land, or the window closes ──────────────────
      let firstPostAt: number | undefined;
      let rosterCompleteAt: number | undefined;
      const deadline = Date.now() + WINDOW_MS;
      while (Date.now() < deadline) {
        await sleep(SAMPLE_MS);
        const bPosts = postTexts(b);
        const bMembers = await b.members(spaceId);
        const aMembers = await a.members(spaceId);
        if (!firstPostAt && bPosts.length > 0) firstPostAt = Date.now();
        if (!rosterCompleteAt && bMembers >= 2) rosterCompleteAt = Date.now();
        log.add(Date.now(), 'harness', 'sample', {
          bPosts: bPosts.length,
          bMembers,
          aMembers,
        });
        if (firstPostAt && rosterCompleteAt) break;
      }

      // ── Report before asserting, so a failing run still produces the numbers ─
      const bPosts = postTexts(b);
      const bMembers = await b.members(spaceId);
      const aMembers = await a.members(spaceId);
      const secs = (t?: number) =>
        t ? `${((t - startedAt) / 1000).toFixed(1)}s` : 'never';

      say('');
      say('==== RESULT ====');
      say(`B posts received : ${bPosts.length}  ${JSON.stringify(bPosts)}`, {
        bPosts: bPosts.length,
      });
      say(
        `   pre-join  ("${preJoinText}") : ${bPosts.includes(preJoinText) ? 'ARRIVED (sync path)' : 'missing'}`
      );
      say(
        `   post-join ("${postJoinText}"): ${bPosts.includes(postJoinText) ? 'ARRIVED (broadcast path)' : 'missing'}`
      );
      say(
        `B member rows    : ${bMembers} (expected 2: itself + A)   first at ${secs(rosterCompleteAt)}`,
        {
          bMembers,
        }
      );
      say(`A member rows    : ${aMembers} (expected 2: itself + B)`, {
        aMembers,
      });
      say(
        `B member writes  : ${b.memberWrites.length} -> ${JSON.stringify(b.memberWrites.map((w) => w.userAddress?.slice(0, 10)))}`
      );
      say(
        `first post at ${secs(firstPostAt)}, roster complete at ${secs(rosterCompleteAt)}`
      );
      say(
        `receive failures : NOVEL A=${a.novelErrors().length} B=${b.novelErrors().length}   ` +
          `replays (expected refusals) A=${a.errors.length - a.novelErrors().length} ` +
          `B=${b.errors.length - b.novelErrors().length}`,
        { aNovel: a.novelErrors().length, bNovel: b.novelErrors().length }
      );
      for (const e of [...a.novelErrors(), ...b.novelErrors()].slice(0, 5))
        say(`   ! ${e.message}`);
      say(
        `outbound failures: A=${a.graph.outbound.failures.length} B=${b.graph.outbound.failures.length}`
      );
      for (const f of [
        ...a.graph.outbound.failures,
        ...b.graph.outbound.failures,
      ]) {
        say(`   ! ${f.error}`);
      }
      say(`log: ${log.file}`);

      // The message half: at least one of A's posts reached B through the real
      // receive path. This is the spec's make-or-break condition.
      expect(bPosts.length).toBeGreaterThan(0);
      // The roster half: B learned about A. B only ever wrote its own row locally,
      // so a second row can only have come off the wire.
      expect(bMembers).toBeGreaterThanOrEqual(2);
    } finally {
      a.stop();
      b.stop();
    }
  },
  10 * 60 * 1000
);
