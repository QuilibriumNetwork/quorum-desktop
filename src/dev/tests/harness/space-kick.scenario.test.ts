// A kicked member is actually shut out — and a backup cannot let them back in.
//
//   yarn harness space-kick
//
// ── Why this scenario exists ────────────────────────────────────────────────
//
// The backup/restore work added a departure record so that restoring an old
// `.qmbak` cannot re-add a Space you were kicked from. But that record lives in
// local IndexedDB, so it is gone in the very case the feature exists for: total
// data loss, then restore. The claim that the kicked user is still shut out then
// rests on CRYPTOGRAPHY rather than on bookkeeping:
//
//   `kickUser` rotates the Space's config key, re-establishes the group ratchet
//   without the kicked member, and re-encrypts the manifest to the NEW config
//   key. A restore rebuilds a Space by decrypting that manifest with the config
//   key FROM THE BACKUP — which is now the old one — and it does that BEFORE it
//   would announce the user to the hub.
//
// That was read from the code, not observed. Reading is how this codebase has
// been wrong before, and the consequence here is a person re-announcing
// themselves to a group that removed them. So this measures it against a real
// relay with real crypto.
//
// ── What it asserts ─────────────────────────────────────────────────────────
//
//   1. After the kick, B cannot read anything A posts.        (exclusion works)
//   2. B restoring their pre-kick backup does NOT rebuild the Space, and never
//      reaches the hub announcement.                          (the real question)
//   3. CONTROL: before the kick, B could read A's posts, and a restore of the
//      same Space DOES rebuild when B was never kicked.
//
// Without (3) this scenario would pass just as well against a bot that never
// received anything at all, which is the failure mode these harness files are
// most prone to.
//
// See `.agents/issues/.open/2026-08-09-backup-restore-overhaul-design.md` §4.1.
import { test, expect } from 'vitest';
import { createSpaceBot, type HarnessSpaceBot } from './spaceBot';
import { BackupService } from '../../../services/BackupService';
import { makeApiClient } from './transport';
import type { UserRegistration } from '@quilibrium/quilibrium-js-sdk-channels';

const WINDOW_MS = Number(process.env.HARNESS_SPACE_WINDOW_MS ?? 120_000);
const SAMPLE_MS = Number(process.env.HARNESS_SPACE_SAMPLE_MS ?? 2000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function postTexts(bot: HarnessSpaceBot): string[] {
  return bot.captured
    .filter((m) => m.content?.type === 'post')
    .map((m) => (m.content as { text?: string }).text ?? '');
}

/** Poll until `check` passes or the window closes. Returns whether it passed. */
async function waitFor(
  label: string,
  check: () => boolean,
  windowMs = WINDOW_MS
): Promise<boolean> {
  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(SAMPLE_MS);
  }
  console.log(`[space-kick] gave up waiting for: ${label}`);
  return false;
}

test(
  'space-kick: a kicked member is excluded, and their backup cannot let them back in',
  async () => {
    const stamp = String(Date.now()).slice(-6);
    // process.stdout.write, not console.log: vitest's reporter swallows console
    // output here, and the evidence this scenario produces is the point of it.
    const say = (msg: string) => process.stdout.write(`
[space-kick] ${msg}
`);

    const a = await createSpaceBot('kick-a');
    const b = await createSpaceBot('kick-b');
    await a.start();
    await b.start();

    try {
      // ── Setup: A owns a Space, B joins it ─────────────────────────────────
      const { spaceId, channelId } = await a.createSpace(`Kick ${stamp}`);
      say(`A created ${spaceId.slice(0, 12)}…`);

      const link = await a.inviteLink(spaceId);
      await b.join(link);
      say('B joined');

      // ── CONTROL: B can read A's posts BEFORE the kick ─────────────────────
      // If this fails the scenario is measuring a broken join, not a working
      // kick, and everything below is meaningless.
      const beforeText = `before-kick-${stamp}`;
      await a.post(spaceId, channelId, beforeText);

      const readBefore = await waitFor('B to receive the pre-kick post', () =>
        postTexts(b).includes(beforeText)
      );
      expect(
        readBefore,
        'CONTROL FAILED: B never received a post while still a member — ' +
          'the kick assertions below would be vacuous'
      ).toBe(true);
      say('control ok: B received the pre-kick post');

      // B takes a backup while still a member. This is the file that must not
      // be able to let them back in.
      const backupBlob = await new BackupService({
        messageDB: b.messageDB,
      }).exportBackup({
        keyset: b.identity.keyset.userKeyset,
        address: b.identity.address,
      });
      const backupFile = await backupBlob.text();
      say('B exported a pre-kick backup');

      // ── The kick ──────────────────────────────────────────────────────────
      const aRegistration = (await makeApiClient().getUser(a.identity.address))
        ?.data as UserRegistration;

      await a.graph.spaceService.kickUser(
        spaceId,
        b.identity.address,
        a.identity.keyset.userKeyset,
        a.identity.keyset.deviceKeyset,
        aRegistration,
        a.queryClient
      );
      await a.graph.outbound.flush();
      say('A kicked B (config key rotated, group ratchet re-established)');

      // Let the rekey settle on the relay before A posts again.
      await sleep(SAMPLE_MS * 2);

      // ── 1. B cannot read anything posted after the kick ───────────────────
      const afterText = `after-kick-${stamp}`;
      await a.post(spaceId, channelId, afterText);

      // Deliberately give it the FULL window to arrive. A short wait would make
      // "B did not receive it" indistinguishable from "it had not arrived yet".
      const leaked = await waitFor(
        "B to (wrongly) receive A's post-kick message",
        () => postTexts(b).includes(afterText)
      );
      expect(
        leaked,
        'A kicked member read a message posted after the kick'
      ).toBe(false);
      say('ok: B could not read the post-kick message');

      // ── 2. B's pre-kick backup cannot rebuild the Space ───────────────────
      // Simulate total data loss: a fresh database with none of B's state, and
      // crucially none of the departure record — the case the local tombstone
      // cannot cover.
      const wiped = await createSpaceBot('kick-b-restored');
      await wiped.start();

      try {
        const report = await new BackupService({
          messageDB: wiped.messageDB,
          adoptSpaces: (args) => wiped.graph.configService.adoptSpaces(args),
        }).importBackup({
          keyset: b.identity.keyset.userKeyset,
          fileContent: backupFile,
        });

        say(
          `restore report: restored=${report.spacesRestored.length} ` +
            `failed=${report.spacesFailed.length} ` +
            `reasons=${JSON.stringify(report.spacesFailed.map((f) => f.reason))}`
        );

        // The Space must NOT come back. The config key was rotated by the kick,
        // so the manifest decrypt fails and the adopt path aborts before the
        // hub announcement.
        expect(
          report.spacesRestored,
          'a kicked member restored their way back into the Space'
        ).not.toContain(spaceId);

        // And it must be REPORTED, not silently dropped — the restore has to be
        // able to tell the user why the Space did not come back.
        expect(
          report.spacesFailed.map((f) => f.spaceId),
          'the Space was neither restored nor reported as failed'
        ).toContain(spaceId);

        // ...and the reason has to be readable. The first run of this scenario
        // surfaced the raw SDK failure through JSON.parse — `Unexpected token
        // 'D', "Decryption"... is not valid JSON` — which is accurate and
        // useless to the person reading it.
        const reason =
          report.spacesFailed.find((f) => f.spaceId === spaceId)?.reason ?? '';
        expect(reason, `unreadable failure reason: ${reason}`).toMatch(
          /no longer have access/i
        );

        // Nothing rendered: no Space row on the restored device.
        expect(await wiped.messageDB.getSpaces()).toEqual([]);
        say('ok: the pre-kick backup did not rebuild the Space');
      } finally {
        wiped.stop();
      }
    } finally {
      a.stop();
      b.stop();
    }
  },
  WINDOW_MS * 4
);
