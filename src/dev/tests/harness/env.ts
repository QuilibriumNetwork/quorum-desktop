// Harness configuration. Reads src/dev/tests/harness/.env.local at runtime if
// present (a tiny dotenv parser — no new dependency). Keys are OPTIONAL: with no
// .env.local the harness generates its own throwaway accounts, which is all
// slices 1-3 need. Provide BOT_*_PRIVATE_KEY only to drive your existing test
// users.
//
// SAFETY: throwaway accounts only. .env.local is gitignored and must never be
// committed. This file only ever READS the values into config — it never logs
// or prints a private key.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseDotenv(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

// process.env wins over the file so CI / one-off overrides work.
const fromFile = parseDotenv(resolve(HERE, '.env.local'));
const get = (k: string, fallback = '') =>
  process.env[k] ?? fromFile[k] ?? fallback;

export const config = {
  apiUrl: get('QUORUM_API_URL', 'https://api.quorummessenger.com'),
  wsUrl: get('QUORUM_WS_URL', 'wss://api.quorummessenger.com/ws'),
  // Optional per-bot account keys (114-char ed448 hex). Empty => generate.
  botKeys: {
    A: get('BOT_A_PRIVATE_KEY'),
    B: get('BOT_B_PRIVATE_KEY'),
  } as Record<string, string>,
  // Where persisted device keysets and logs live (both gitignored).
  stateDir: resolve(HERE, '.state'),
  logsDir: resolve(HERE, 'logs'),
};

export type HarnessConfig = typeof config;
