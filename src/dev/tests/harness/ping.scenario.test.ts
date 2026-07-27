// SLICE 1 — the smallest proof the stack is real: a bot mints (or loads) a
// throwaway account, registers it on the relay, opens the live WebSocket, and
// subscribes to its own inbox.
//
// Observable outcome: the console prints the bot's address + inbox address and
// "connected & listening". A real registration now exists on the relay; re-runs
// reuse the persisted device (no new registration).
//
//   yarn harness ping
//
// NOTE: this performs a REAL registration against config.apiUrl (production by
// default). Throwaway accounts only.
import { test, expect } from 'vitest';
import { loadOrCreateBot } from './identity';
import { makeApiClient, WsTransport } from './transport';
import { config } from './env';

test('ping: a bot registers, connects, and subscribes to its inbox', async () => {
  const api = makeApiClient();

  const bot = await loadOrCreateBot('ping-bot', api);
  console.log(`[ping] account address : ${bot.address}`);
  console.log(`[ping] inbox address   : ${bot.inboxAddress}`);
  expect(bot.address.length).toBeGreaterThan(0);
  expect(bot.inboxAddress.length).toBeGreaterThan(0);

  // Prove the registration is really on the relay.
  const registered = (await api.getUser(bot.address))?.data;
  expect(registered?.device_registrations?.length ?? 0).toBeGreaterThan(0);
  console.log(
    `[ping] relay confirms ${registered?.device_registrations?.length} device(s) registered`
  );

  const ws = new WsTransport(config.wsUrl);
  let received = 0;
  ws.onMessage(() => {
    received += 1;
  });
  await ws.connect();
  ws.listen([bot.inboxAddress]);
  console.log(`[ping] connected & listening on ${config.wsUrl}`);
  expect(ws.connected).toBe(true);

  // Hold the socket briefly so a manual browser-sent DM (slice 2) could land.
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`[ping] frames received while listening: ${received}`);

  ws.close();
});
