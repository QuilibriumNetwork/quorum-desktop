// Integration sanity check (no network) — the harness's load-bearing seams:
// MessageDB opens on fake-indexeddb, and the full MessageService import graph
// loads under the jsdom+lingui pipeline. Fast, CI-safe; hits no relay.
import { test, expect } from 'vitest';
import { makeMessageDB } from './storage';
import { MessageService } from '../../../services/MessageService';

test('probe: MessageDB opens on fake-indexeddb', async () => {
  const db = await makeMessageDB();
  const states = await db.getAllEncryptionStates();
  expect(Array.isArray(states)).toBe(true);
  console.log(`[probe] MessageDB opened; ${states.length} encryption states`);
});

test('probe: MessageService import graph loads under node', () => {
  expect(typeof MessageService).toBe('function');
  console.log('[probe] MessageService imported OK');
});
