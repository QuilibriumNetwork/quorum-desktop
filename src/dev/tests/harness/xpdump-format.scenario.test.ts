// Offline check: the [XPDUMP] lines the harness emits are readable by the
// existing dr-ablate / dr-replay parsers, so those tools run on harness output
// unchanged. Uses a synthetic state/frame — no network, no real failure needed;
// this asserts the FORMAT, not a decrypt.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeMessageDB } from './storage';
import { XpdumpLog } from './xpdump';

test('xpdump-format: emitted lines parse with the dr-ablate reader', async () => {
  const db = await makeMessageDB();
  const inbox = 'QmInboxAddressForTest0000000000000000000000000';

  // Realistically-shaped state: EncryptionState.state is JSON with ratchet_state
  // as a nested JSON string, exactly as MessageService persists it.
  const ratchetState = JSON.stringify({
    skipped_keys_map: {},
    current_sending_chain_length: 3,
    current_receiving_chain_length: 2,
    previous_sending_chain_length: 0,
  });
  await db.saveEncryptionState(
    {
      state: JSON.stringify({ ratchet_state: ratchetState, receiving_inbox: {}, tag: 't' }),
      timestamp: 111,
      inboxId: inbox,
      conversationId: 'QmConv/QmConv',
    },
    true
  );

  const xp = new XpdumpLog('xpdump-format-test', 1000);
  const frame = {
    inboxAddress: inbox,
    encryptedContent: JSON.stringify({ ephemeral_public_key: 'deadbeef', envelope: '{}' }),
    timestamp: 222,
  };
  const ok = await xp.capture(db, frame, 2000);
  expect(ok).toBe(true);

  // Re-parse with dr-ablate's exact regex + reassembly.
  const text = readFileSync(xp.file, 'utf-8');
  const parts = new Map<string, { total: number; chunks: Map<number, string> }>();
  for (const line of text.split('\n')) {
    const m = line.match(/\[XPDUMP\]\s+(\d+)\/(\d+)\/(\d+)\s(.*)$/);
    if (!m) continue;
    const [, no, idx, total, chunk] = m;
    if (!parts.has(no)) parts.set(no, { total: +total, chunks: new Map() });
    parts.get(no)!.chunks.set(+idx, chunk);
  }
  expect(parts.size).toBe(1);

  const { total, chunks } = [...parts.values()][0];
  const joined = Array.from({ length: total }, (_, i) => chunks.get(i + 1)).join('');
  const record = JSON.parse(joined);
  const row = JSON.parse(record.state);
  const rs = JSON.parse(row.ratchet_state);
  const sealed = JSON.parse(record.frame);

  expect(rs.current_sending_chain_length).toBe(3);
  expect(sealed.ephemeral_public_key).toBe('deadbeef');
  console.log('[xpdump-format] dr-ablate reader parsed the emitted record OK');
});
