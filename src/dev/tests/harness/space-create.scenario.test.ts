// SLICE S0 — the recon spike. Can a headless bot create a real space?
//
//   yarn harness space-create
//
// This answers the one question that sizes the whole space harness: does space
// creation need anything a Node process cannot supply — a passkey prompt, a
// browser API, a service the DM harness stubbed? The spec flagged it as the
// assumption recon could not resolve from reading alone.
//
// It is deliberately NOT a test of sync, delivery or membership. It asserts only
// that the manifest we just published reads back from the relay and decrypts
// with the config key we hold, and that the space is a functioning member of
// this bot's local state (encryption session, keys, member row). If this fails,
// Path A of the spec is blocked and the design has to change.
import { test, expect } from 'vitest';
import { createSpaceBot } from './spaceBot';

test(
  'space-create: a headless bot creates a real space and reads its manifest back',
  async () => {
    const stamp = String(Date.now()).slice(-6);
    const bot = await createSpaceBot(`space-a-${stamp}`);
    await bot.start();

    const spaceName = `harness-s0-${stamp}`;
    const { spaceId, channelId } = await bot.createSpace(spaceName);
    console.log(`[space-create] bot=${bot.identity.address.slice(0, 12)}`);
    console.log(`[space-create] spaceId=${spaceId}`);
    console.log(`[space-create] channelId=${channelId} (default channel)`);

    // 1. The relay has it. This is the "created on the relay" half — everything
    //    else below could pass against a purely local write.
    const local = await bot.messageDB.getSpace(spaceId);
    expect(local?.spaceName).toBe(spaceName);

    // 2. It reads back through the REAL join-side decode path
    //    (InvitationService.processInviteLink → getSpaceManifest → decrypt with
    //    the config key). Going through the invite link rather than a raw GET is
    //    the point: it proves the manifest is decryptable by a joiner, which is
    //    the precondition for S1.
    const link = await bot.inviteLink(spaceId);
    expect(link).toContain(spaceId);
    const fetched = await bot.graph.invitationService.processInviteLink(link);
    console.log(`[space-create] manifest read back from relay: "${fetched.spaceName}"`);
    expect(fetched.spaceId).toBe(spaceId);
    expect(fetched.spaceName).toBe(spaceName);
    expect(fetched.defaultChannelId).toBe(channelId);

    // 3. The bot is a functioning member: triple-ratchet session, space keys and
    //    its own member row. Without these it could not post or answer a sync.
    const states = await bot.messageDB.getEncryptionStates({
      conversationId: `${spaceId}/${spaceId}`,
    });
    expect(states.length).toBeGreaterThan(0);
    const hubKey = await bot.messageDB.getSpaceKey(spaceId, 'hub');
    expect(hubKey?.address).toBeTruthy();
    const memberCount = await bot.members(spaceId);
    console.log(`[space-create] local member rows=${memberCount} encryptionStates=${states.length}`);
    expect(memberCount).toBe(1);

    // 4. A second channel, so createChannel is exercised too (spec S0 names it).
    const extraChannelId = await bot.graph.spaceService.createChannel(spaceId);
    const extraKey = await bot.messageDB.getSpaceKey(spaceId, extraChannelId);
    console.log(`[space-create] extra channel=${extraChannelId}`);
    expect(extraKey?.privateKey).toBeTruthy();

    // 5. Nothing in the outbound queue threw. Space creation enqueues the
    //    manifest broadcast and the space-inbox `listen`; a silent failure there
    //    would leave the bot unable to receive anything for this space, and the
    //    app's queue swallows errors, so this is the only place it surfaces.
    console.log(
      `[space-create] outbound: sent=${bot.graph.outbound.sentCount} ` +
        `listened=${bot.graph.outbound.listenedInboxes.length} ` +
        `failures=${bot.graph.outbound.failures.length}`
    );
    for (const f of bot.graph.outbound.failures) console.log(`   ! ${f.error}`);
    expect(bot.graph.outbound.failures).toEqual([]);

    bot.stop();
  },
  180_000
);
