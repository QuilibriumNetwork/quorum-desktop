// What logging back in actually restores after a storage eviction — and what
// silently does not.
//
//   yarn harness space-wipe-restore
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// `.agents/issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md`
// carries a recoverability table saying profile, Spaces and Space keys come back
// on login while DMs do not. `dm-itp-wipe` already measured the DM half. This
// measures the OTHER half, which nothing covered: the restore runs through
// `ConfigService.getConfig`, and the DM harness is transport-level and never
// touches it.
//
// ── The variable ───────────────────────────────────────────────────────────
//
// Both arms are the same account shape doing the same things. Exactly one thing
// differs: `allowSync`.
//
// That is the variable because the recovery the issue describes is not a
// property of having an account — it is a property of having PUBLISHED. Reading
// the code says publication is gated:
//
//   - `saveConfig` builds `config.spaceKeys` only inside `if (config.allowSync)`
//     (ConfigService.ts:695), and the `postUserSettings` call sits inside that
//     same block (ConfigService.ts:864). Sync off ⇒ nothing ever reaches the
//     server.
//   - `allowSync` is device-local and defaults to FALSE
//     (ConfigService.ts:289, `storedConfig?.allowSync ?? false`).
//
// So the sync-off arm is not a contrived edge case, it is the DEFAULT, and if it
// restores nothing then the issue's table is true only for the subset of users
// who turned sync on. Reading is how this codebase has been wrong before, so
// both arms are measured rather than argued.
//
// The sync-off arm doubles as the control: if BOTH arms restored their Spaces,
// something other than the published config would be putting them back and every
// conclusion here would be wrong.
import { test, expect } from 'vitest';
import type { UserRegistration } from '@quilibrium/quilibrium-js-sdk-channels';
import { createSpaceBot, type HarnessSpaceBot } from './spaceBot';
import { makeApiClient } from './transport';
import { dmCensus } from './inspect';
import { deleteDatabaseFor } from './storage';

interface Snapshot {
  spaces: number;
  /** Sorted keyIds, not a count — WHICH key is missing is the interesting part. */
  keyIds: string[];
  displayName: string | undefined;
  dmMessages: number;
  dmConversations: number;
  /** conversationIds of every encryption_states row, sorted. */
  stateConvs: string[];
}

async function snapshot(bot: HarnessSpaceBot): Promise<Snapshot> {
  const address = bot.identity.address;
  const spaces = await bot.messageDB.getSpaces();
  const keyIds: string[] = [];
  for (const s of spaces) {
    for (const k of await bot.messageDB.getSpaceKeys(s.spaceId)) keyIds.push(k.keyId);
  }
  const cfg = await bot.messageDB.getUserConfig({ address });
  const dm = await dmCensus(bot.messageDB, address);
  const states = await bot.messageDB.getAllEncryptionStates();
  return {
    spaces: spaces.length,
    keyIds: keyIds.sort(),
    displayName: cfg?.name,
    dmMessages: dm.messages,
    dmConversations: dm.conversations,
    stateConvs: states.map((s) => s.conversationId).sort(),
  };
}

const fmt = (s: Snapshot) =>
  `spaces=${s.spaces} keys=[${s.keyIds.join(',')}] name=${s.displayName ?? '(none)'} ` +
  `dmMessages=${s.dmMessages} dmConvs=${s.dmConversations} ` +
  `states=[${s.stateConvs.map((c) => c.slice(0, 20)).join(' | ')}]`;

/**
 * Send one DM through the real submitMessage path, purely to put DM rows on
 * disk. Delivery is NOT awaited: the sender persists its own copy, which is all
 * this scenario needs. Whether DMs traverse the wire is dm-basic's job.
 */
async function seedDm(from: HarnessSpaceBot, to: HarnessSpaceBot, text: string): Promise<void> {
  const apiClient = makeApiClient();
  const self = (await apiClient.getUser(from.identity.address))?.data as UserRegistration;
  const counterparty = (await apiClient.getUser(to.identity.address))?.data as UserRegistration;
  await from.graph.messageService.submitMessage(
    to.identity.address,
    text,
    self,
    counterparty,
    from.queryClient,
    {
      credentialId: '',
      address: from.identity.address,
      publicKey: Buffer.from(
        new Uint8Array(from.identity.keyset.userKeyset.user_key.public_key)
      ).toString('hex'),
      completedOnboarding: true,
    },
    from.identity.keyset
  );
}

/** Set the profile name and sync preference, then run the real publish path. */
async function publishConfig(
  bot: HarnessSpaceBot,
  { allowSync, name }: { allowSync: boolean; name: string }
): Promise<void> {
  const address = bot.identity.address;
  const current = await bot.graph.configService.getConfig({
    address,
    userKey: bot.identity.keyset.userKeyset,
  });
  await bot.graph.configService.saveConfig({
    config: { ...current, address, name, allowSync },
    keyset: bot.identity.keyset,
  });
}

test(
  'space-wipe-restore: login rebuilds Spaces and profile only for a published config, and never DMs',
  async () => {
    const stamp = String(Date.now()).slice(-6);
    const [on, off] = await Promise.all([
      createSpaceBot(`cfg-on-${stamp}`),
      createSpaceBot(`cfg-off-${stamp}`),
    ]);
    await Promise.all([on.start(), off.start()]);

    // try/finally: an early throw would otherwise leak a live production socket
    // and the ActionQueue interval per bot for the rest of the worker process.
    try {
      // ── 1. Both accounts get the same shape: a Space, a profile, a DM ─────
      const onSpace = await on.createSpace(`wipe-restore-on-${stamp}`);
      const offSpace = await off.createSpace(`wipe-restore-off-${stamp}`);

      await seedDm(on, off, `dm-from-on-${stamp}`);
      await seedDm(off, on, `dm-from-off-${stamp}`);

      // ── 2. The one difference ────────────────────────────────────────────
      await publishConfig(on, { allowSync: true, name: `Synced ${stamp}` });
      await publishConfig(off, { allowSync: false, name: `Unsynced ${stamp}` });

      const onBefore = await snapshot(on);
      const offBefore = await snapshot(off);
      console.log(`[space-wipe-restore] sync ON  BEFORE  ${fmt(onBefore)}`);
      console.log(`[space-wipe-restore] sync OFF BEFORE  ${fmt(offBefore)}`);

      // Preconditions. Without these, every "it came back" below could pass
      // against an account that never had anything in the first place.
      expect(onBefore.spaces).toBeGreaterThan(0);
      expect(onBefore.keyIds.length).toBeGreaterThan(0);
      expect(onBefore.dmMessages).toBeGreaterThan(0);
      expect(offBefore.spaces).toBeGreaterThan(0);
      expect(offBefore.keyIds.length).toBeGreaterThan(0);
      expect(offBefore.dmMessages).toBeGreaterThan(0);

      // ── 3. The eviction — both arms, identically ─────────────────────────
      await Promise.all([
        deleteDatabaseFor(on.messageDB),
        deleteDatabaseFor(off.messageDB),
      ]);
      // In-memory Space registrations survive in this process but would not
      // survive the browser reload that follows a real eviction. Clearing them
      // keeps the restore honest: adoptSpaces has to rebuild from the published
      // blob, not read a leftover.
      on.graph.spaceInfo.current = {};
      off.graph.spaceInfo.current = {};

      const onWiped = await snapshot(on);
      const offWiped = await snapshot(off);
      console.log(`[space-wipe-restore] sync ON  WIPED   ${fmt(onWiped)}`);
      console.log(`[space-wipe-restore] sync OFF WIPED   ${fmt(offWiped)}`);

      expect(onWiped).toEqual({
        spaces: 0,
        keyIds: [],
        displayName: undefined,
        dmMessages: 0,
        dmConversations: 0,
        stateConvs: [],
      });
      expect(offWiped).toEqual(onWiped);

      // ── 4. Log back in ───────────────────────────────────────────────────
      // getConfig IS the returning-user path: fetch the encrypted blob, verify
      // its ed448 signature, decrypt it, then adoptSpaces() rebuilds Spaces and
      // key material from `config.spaceKeys`.
      await Promise.all([
        on.graph.configService.getConfig({
          address: on.identity.address,
          userKey: on.identity.keyset.userKeyset,
        }),
        off.graph.configService.getConfig({
          address: off.identity.address,
          userKey: off.identity.keyset.userKeyset,
        }),
      ]);

      const onAfter = await snapshot(on);
      const offAfter = await snapshot(off);
      console.log(`[space-wipe-restore] sync ON  RESTORED ${fmt(onAfter)}`);
      console.log(`[space-wipe-restore] sync OFF RESTORED ${fmt(offAfter)}`);

      // ── 5. What the published config gave back ───────────────────────────
      expect(onAfter.spaces).toBe(onBefore.spaces);
      expect(onAfter.displayName).toBe(onBefore.displayName);
      expect((await on.messageDB.getSpace(onSpace.spaceId))?.spaceId).toBe(onSpace.spaceId);
      console.log(
        `[space-wipe-restore] key delta: before=[${onBefore.keyIds.join(',')}] ` +
          `after=[${onAfter.keyIds.join(',')}] ` +
          `missing=[${onBefore.keyIds.filter((k) => !onAfter.keyIds.includes(k)).join(',')}]`
      );

      // Every key returns EXCEPT `signing`, and that gap is deliberate rather
      // than a hole in the recovery. `adoptSpaces` skips the synced `signing`
      // slot (ConfigService.ts:467) so a restored device signs with its OWN
      // per-device `inbox` key — `getSigningKey` falls through to it
      // (MessageService.ts:1757). Asserting the exact set, rather than a count,
      // means deleting that `continue` turns this red instead of silently
      // putting a restored device back on a shared signing key.
      expect(onAfter.keyIds).toEqual(onBefore.keyIds.filter((k) => k !== 'signing'));
      // ...so the key it signs with instead had better be present.
      expect(onAfter.keyIds).toContain('inbox');

      // ...and what it did NOT restore. There is no server-side copy of DM
      // data, so the login that rebuilt an entire Space leaves the
      // conversations at zero.
      expect(onAfter.dmMessages).toBe(0);
      expect(onAfter.dmConversations).toBe(0);

      // The only ratchet state that comes back is the SPACE group ratchet,
      // carried in `config.spaceKeys[].encryptionState`. The DM ratchet — the
      // thing that would let an existing conversation continue — is not in the
      // parcel and does not return.
      expect(onAfter.stateConvs).toEqual([`${onSpace.spaceId}/${onSpace.spaceId}`]);

      // ── 6. The unpublished account gets nothing ──────────────────────────
      // Same eviction, same login, no published blob. This is the control: if
      // this arm also came back, something other than the config would be doing
      // the restoring and step 5 would prove nothing.
      expect(offAfter.spaces).toBe(0);
      expect(offAfter.keyIds).toEqual([]);
      expect(offAfter.dmMessages).toBe(0);
      expect(await off.messageDB.getSpace(offSpace.spaceId)).toBeNull();
    } finally {
      on.stop();
      off.stop();
    }
  },
  300_000
);
