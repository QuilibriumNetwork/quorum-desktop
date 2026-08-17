// CROSS-CLIENT. Desktop publishes a user config; MOBILE reads it back.
//
//   yarn harness:config-cross          (runs both halves, in order)
//   yarn harness config-cross          (this half alone — publish only)
//
// This is the desktop half. It answers a question neither repo could answer
// alone: does a config written by DESKTOP decrypt and land correctly on MOBILE?
//
// Everything before this was same-client. Mobile's own scenario proves mobile
// round-trips its own blob, which is real evidence about the wire format but
// says nothing about the other client — and the two ConfigService
// implementations are independent code that share only a type. The known
// merge-asymmetry issue exists precisely because they drifted.
//
// ─── How the two halves share an account ────────────────────────────────────
//
// Config sync is per-ACCOUNT, so both clients must be the same account. Mobile
// owns the identity: its harness already persists a throwaway account key at
// dev/harness/.state/config-sync-bot.json (gitignored, generated, never a real
// account — see mobile's identity.ts for why a persisted key means "throwaway
// by construction"). This half loads that key and publishes as that account,
// which is exactly what a second device does.
//
// It then writes the values it published to a handoff file in mobile's
// rendezvous directory, so mobile asserts against what was ACTUALLY sent rather
// than against a constant duplicated in two repos that can drift apart.
//
// ⚠️ Writes a REAL settings row on production for that throwaway account.
import { test, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createSpaceBot } from './spaceBot';
import type { UserConfig } from '../../../db/messages';

const DESKTOP_REPO = resolve(__dirname, '../../../..');
const MOBILE_REPO = resolve(DESKTOP_REPO, '..', 'quorum-mobile');
const MOBILE_BOT_STATE = resolve(MOBILE_REPO, 'dev/harness/.state/config-sync-bot.json');
const HANDOFF = resolve(MOBILE_REPO, 'dev/harness/.state/rendezvous/config-cross.json');

test('config-cross: desktop publishes a config for the shared account', async () => {
  if (!existsSync(MOBILE_BOT_STATE)) {
    throw new Error(
      `No mobile bot state at ${MOBILE_BOT_STATE}.\n` +
        'Run mobile\'s own scenario first to mint the shared throwaway account:\n' +
        '  cd ../quorum-mobile && yarn harness:config-sync'
    );
  }
  const { privateKeyHex } = JSON.parse(readFileSync(MOBILE_BOT_STATE, 'utf8')) as {
    privateKeyHex?: string;
  };
  // A state file WITHOUT privateKeyHex means mobile was pointed at a real
  // account through its env var, and this scenario must not publish over it.
  expect(
    privateKeyHex,
    'mobile bot state has no privateKeyHex — that means it is NOT a throwaway account'
  ).toBeTruthy();

  const bot = await createSpaceBot('config-cross-desktop', { privateKeyHex });
  await bot.start();

  try {
    const stamp = String(Date.now());
    // Distinctive enough that mobile adopting a stale row cannot pass by
    // coincidence, and covering both a short string and a bulk field.
    const published = {
      name: `desktop-cross-${stamp}`,
      profile_image: `data:image/png;base64,DESKTOP${stamp}`,
    };

    const existing = await bot.graph.configService.getConfig({
      address: bot.identity.address,
      userKey: bot.identity.keyset.userKeyset,
    });

    const config: UserConfig = {
      ...existing,
      allowSync: true,
      name: published.name,
      profile_image: published.profile_image,
    } as UserConfig;

    await bot.graph.configService.saveConfig({ config, keyset: bot.identity.keyset });

    // The publish must be real before mobile is asked to read it. Reading the
    // row straight back off the relay is the only check that distinguishes
    // "accepted" from "stored" — mobile's half would otherwise fail with a
    // misleading verdict about the OTHER client.
    const stored = await bot.graph.configService.getConfig({
      address: bot.identity.address,
      userKey: bot.identity.keyset.userKeyset,
    });
    expect(stored.name).toBe(published.name);

    console.log(`[config-cross] desktop published as ${bot.identity.address.slice(0, 12)}…`);
    console.log(`[config-cross] name=${published.name}`);

    mkdirSync(dirname(HANDOFF), { recursive: true });
    writeFileSync(
      HANDOFF,
      JSON.stringify({ publishedBy: 'desktop', at: Date.now(), ...published }, null, 2)
    );
    console.log(`[config-cross] handoff written for mobile: ${HANDOFF}`);
  } finally {
    // Synchronous, and in a finally so a failed assertion still clears the
    // ActionQueue interval and closes the socket — otherwise the run hangs.
    bot.stop();
  }
}, 300_000);
