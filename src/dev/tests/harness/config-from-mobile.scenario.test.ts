// CROSS-CLIENT, the direction that was missing. MOBILE publishes a user config;
// this half reads it back on DESKTOP.
//
//   yarn harness:config-cross            (runs BOTH directions, in order)
//   yarn harness config-from-mobile      (this half alone, after mobile published)
//
// `config-cross.scenario.test.ts` next to this file covers desktop → mobile.
// One direction is not symmetric evidence: encryption, signing and field
// ordering are written twice, once per client, so "desktop's blob decrypts on
// mobile" says nothing about the reverse. The known merge-asymmetry issue
// exists precisely because the two implementations drifted.
//
// Mobile's half (`dev/harness/config-to-desktop.scenario.ts` in quorum-mobile)
// publishes for the shared throwaway account, proves the row landed by reading
// it straight back off the relay, and writes what it sent to the handoff file
// below. This half asserts against that file rather than a constant, so the two
// repos cannot drift into agreeing about a value neither actually sent.
//
// ─── The file name avoids "config-cross" on purpose ─────────────────────────
//
// `yarn harness config-cross` passes its argument to vitest as a path filter,
// so a file named `config-cross-from-mobile` would be pulled into the other
// direction's run as well. Both would then read and write the same account's
// row in an order vitest does not guarantee, and the resulting failure would
// look like a protocol bug rather than a naming accident.
//
// ⚠️ Reads a REAL settings row on production for that throwaway account.
import { test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSpaceBot } from './spaceBot';
import { resolveMobileRepo } from './mobileRepo.mjs';

const DESKTOP_REPO = resolve(__dirname, '../../../..');
// Via the helper, NOT as a sibling of this checkout: that guess is wrong from
// a linked worktree. See mobileRepo.mjs.
const MOBILE_REPO = resolveMobileRepo(DESKTOP_REPO);
const MOBILE_BOT_STATE = resolve(MOBILE_REPO, 'dev/harness/.state/config-sync-bot.json');
const HANDOFF = resolve(MOBILE_REPO, 'dev/harness/.state/rendezvous/config-from-mobile.json');

/** How old a handoff may be before it is treated as a different run's leftovers. */
const MAX_HANDOFF_AGE_MS = 30 * 60 * 1000;

test('config-cross: desktop adopts a config that MOBILE published', async () => {
  if (!existsSync(HANDOFF)) {
    throw new Error(
      `No handoff at ${HANDOFF}.\n` +
        'The mobile half publishes first. From the mobile repo:\n' +
        '  yarn harness:config-to-desktop'
    );
  }

  const handoff = JSON.parse(readFileSync(HANDOFF, 'utf8')) as {
    publishedBy: string;
    at: number;
    name: string;
    profile_image: string;
  };

  // A stale handoff is the failure mode that would quietly turn this into a
  // no-op: the assertions would still pass, against a row from an old run,
  // while proving nothing about the code as it stands today.
  expect(handoff.publishedBy).toBe('mobile');
  const age = Date.now() - handoff.at;
  if (age > MAX_HANDOFF_AGE_MS) {
    throw new Error(
      `Handoff is ${Math.round(age / 60_000)} minutes old, which is older than this ` +
        'check trusts. Re-run the mobile half so the row on the relay matches it.'
    );
  }

  if (!existsSync(MOBILE_BOT_STATE)) {
    throw new Error(
      `No mobile bot state at ${MOBILE_BOT_STATE}.\n` +
        'Both halves must be the same account; mobile owns the key.'
    );
  }
  const { privateKeyHex } = JSON.parse(readFileSync(MOBILE_BOT_STATE, 'utf8')) as {
    privateKeyHex?: string;
  };
  // A state file WITHOUT privateKeyHex means mobile was pointed at a real
  // account through its env var, and this scenario must not touch it.
  expect(
    privateKeyHex,
    'mobile bot state has no privateKeyHex — that means it is NOT a throwaway account'
  ).toBeTruthy();

  const bot = await createSpaceBot('config-cross-read-desktop', { privateKeyHex });
  await bot.start();

  try {
    const adopted = await bot.graph.configService.getConfig({
      address: bot.identity.address,
      userKey: bot.identity.keyset.userKeyset,
    });

    // THE cross-client assertion, and the one this whole direction existed to
    // make. A short string and a bulk field, because the name alone would pass
    // even if the image were being dropped in transit.
    expect(adopted.name).toBe(handoff.name);
    expect((adopted as unknown as { profile_image?: string }).profile_image).toBe(
      handoff.profile_image
    );

    // Mobile published `allowSync: true`. Desktop must still refuse to inherit
    // it — this bot has no stored config, which is exactly the fresh-install
    // case the device-local rule was written for (#322). Now proven across
    // clients rather than only against desktop's own blob.
    expect(adopted.allowSync).toBe(false);

    console.log(
      `[config-cross] desktop adopted mobile's config: name=${adopted.name === handoff.name} image=${
        (adopted as unknown as { profile_image?: string }).profile_image ===
        handoff.profile_image
      }`
    );
  } finally {
    // Synchronous, and in a finally so a failed assertion still clears the
    // ActionQueue interval and closes the socket — otherwise the run hangs.
    bot.stop();
  }
}, 300_000);
