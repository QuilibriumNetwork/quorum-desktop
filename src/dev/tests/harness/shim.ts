// Browser-surface shim. Side-effect only. MUST be imported before the SDK, whose
// browser bundle assigns `window.Buffer` at module-eval time, and before the
// app's config, which reads `window.location`. Kept in its own file so it is
// evaluated ahead of any SDK import (ESM evaluates imported modules in order).
//
// This is NOT jsdom and NOT a mock — just the minimum browser globals so a
// browser bundle can load under a real node environment (which keeps node's real
// WebSocket + webcrypto, both of which the harness needs).
import { Buffer as NodeBuffer } from 'node:buffer';

const g = globalThis as unknown as {
  window?: unknown;
  Buffer?: unknown;
  crypto?: unknown;
};

if (!g.window) g.window = g;
const w = g.window as { location?: unknown; Buffer?: unknown; crypto?: unknown };
// Concrete origin so config.quorum's getConfig() never throws. Its value is
// unused — the harness passes explicit prod URLs to the API client and transport.
if (!w.location) w.location = { origin: 'http://localhost' };
if (!g.Buffer) g.Buffer = NodeBuffer;
if (!w.Buffer) w.Buffer = NodeBuffer;
// Node 22 provides globalThis.crypto (webcrypto); mirror onto window for the
// SDK's window.crypto.subtle paths.
if (g.crypto && !w.crypto) w.crypto = g.crypto;
