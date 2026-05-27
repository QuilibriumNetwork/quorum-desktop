---
type: spec
title: Link Previews — Design
status: deferred
created: 2026-05-27
updated: 2026-05-27
---

# Link Previews — Design Spec

## Status

**Design complete.** Implementation can start on the Electron path independently.

One open blocker for browser support (see [Open Questions](#open-questions)). The Electron path is fully specified and can ship without resolving this; browser users see plain links until the open question is decided.

This spec deliberately defers two adjacent concerns to follow-up specs:

- **Global privacy toggle** (governs both YouTube embeds and link previews) — separate spec.
- **EditMessage feature parity with send** (adding `embeddedMedia` to edits) — separate spec.

Both follow-ups are referenced in [Related Work](#related-work).

---

## Goal

Render rich previews for URLs shared in messages — title, description, site name, hero image — without leaking receivers' IPs or other metadata to third-party websites. Match the privacy model already established by the YouTube facade (see [youtube-facade-optimization.md](../docs/features/messages/youtube-facade-optimization.md)).

## Non-Goals

- A privacy toggle to enable/disable previews (separate spec).
- Editing a message's preview when the URL changes (separate spec).
- Support for arbitrary OG-like protocols beyond OpenGraph + Twitter Cards + standard HTML `<title>`.
- Server-side preview caching of any kind.
- Receiver-side fetching under any circumstances.

---

## Privacy Model

The sender's client fetches preview metadata (title, description, site name, image) at compose time, embeds the bytes as base64 into the existing `PostMessage.embeddedMedia` array (the same field used today for YouTube thumbnails and attached images), and the encrypted message is sent normally. Receivers render the preview purely from embedded bytes — they never make a network request to the third-party site.

| Action | Who contacts the third-party site |
|---|---|
| Sender previews their own URL | Sender's machine (Electron main process) |
| Receiver sees a preview | Nobody — bytes come from embedded data |
| Receiver clicks the link | Receiver's machine (same as any link click in any app) |

**No degradation for messages without previews.** If `embeddedMedia` has no `link-preview` entry, the link renders as today — a plain clickable URL. Older messages from before this feature ships are unaffected.

**Default state at ship time:** previews are **always on** for the sender, matching today's YouTube fetch behavior. The follow-up toggle spec will land the "off by default" privacy default for both YouTube and link previews behind a single switch. Implementation must structure call sites so adding the future toggle is a one-line guard.

---

## Scope & URL Detection

### Which URLs get previews

- Only the **first standalone URL** in the message (Telegram-style). Maximum one preview per message.
- "Standalone" means the URL is alone on its line, using the same definition already used for YouTube embeds in [MessageMarkdownRenderer.tsx](../../src/components/message/MessageMarkdownRenderer.tsx).
- Inline URLs (mixed with text on the same line) stay as plain clickable links.
- If the first standalone URL is a YouTube URL, the YouTube facade takes priority — no separate link-preview card is fetched. The two features remain distinct.

### Sanitization before fetch

A new utility in `quorum-shared/src/utils/urlPreview.ts` exposes:

```ts
export function sanitizeUrlForPreview(rawUrl: string): string | null;
```

Returns the sanitized URL string used for the fetch, or `null` if the URL should not be previewed at all. Sanitization rules:

- Strip tracking parameters: `utm_*`, `fbclid`, `gclid`, `mc_eid`, `mc_cid`, `ref`, `ref_src`, `_ga`, `igshid`, `si`. Final list finalized in implementation.
- **The user-visible URL in the message is never modified.** What the user typed is what receivers see and click.

### What's excluded entirely (returns `null` from sanitizer)

- `localhost`, `127.0.0.1`, IPv6 loopback, RFC1918 private IPs (`10.x`, `192.168.x`, `172.16.x`–`172.31.x`), `.local` mDNS hostnames.
- Non-`http` / non-`https` schemes (`file:`, `data:`, `javascript:`, custom schemes).
- URLs over 2048 characters total length.

### Length caps on parsed metadata

- Title: 200 chars
- Description: 300 chars
- Site name: 60 chars

Strings truncated with ellipsis at the parsing stage.

---

## Fetch Pipeline

### Electron path (fully specified)

The metadata fetch runs in the **Electron main process** via a new IPC handler, not the renderer. This bypasses CORS and matches how desktop messaging apps normally do this.

**New surface:**

- `web/electron/main.cjs`: new IPC handler `fetch-link-preview`
- `web/electron/preload.cjs`: expose `window.electron.fetchLinkPreview(url)` to the renderer
- Renderer falls back to `null` when `window.electron` is undefined (browser build)

**IPC contract:**

```ts
type LinkPreviewResult = {
  title: string;
  description?: string;
  siteName?: string;
  imageBase64?: string;
  imageMimeType?: string;
} | null;

window.electron.fetchLinkPreview(sanitizedUrl: string): Promise<LinkPreviewResult>;
```

### HTTP request limits (main process)

| Limit | Value |
|---|---|
| Method | `GET` only |
| Headers sent | `User-Agent: Mozilla/5.0 (compatible; Quorum-Preview/1.0)`, `Accept: text/html`, `Accept-Language: en` |
| Headers explicitly omitted | `Cookie`, any auth headers |
| Max redirects | 3 |
| Redirect re-validation | Each redirect target re-runs sanitization + IP/scheme allowlist |
| HTML response size cap | 256 KB (stream and abort on overflow) |
| HTML fetch timeout | 5 seconds wall-clock |
| Image fetch timeout | 5 seconds wall-clock |
| Accepted Content-Type | `text/html` (case-insensitive prefix match) — everything else returns `null` |

### HTML parsing

- Parse only the `<head>` section. Abort at first `</head>` or first `<body>` tag.
- Extraction priority: `og:title` → `twitter:title` → `<title>`. Same fallback chain for description (`og:description` → `twitter:description` → `<meta name="description">`) and image (`og:image` → `twitter:image`).
- Site name: `og:site_name` with hostname fallback.
- HTML entities decoded by the parser.
- Apply length caps (Section: Scope).

### Image processing

- If `og:image` is absent or fails the scheme/IP allowlist → return text-only preview (no image fields).
- Fetch image with the same timeout/redirect/IP rules as the HTML.
- Downscale to **max 400×210** preserving aspect ratio.
- Re-encode as **JPEG q70**.
- Final image cap: **30 KB**. If the re-encoded result exceeds 30 KB → drop the image (text-only preview).
- Total `embeddedMedia` entry cap (image + metadata strings): **40 KB**. Hard-enforced; oversize entries are not embedded and the message ships with no preview.

### Failure modes

All errors (network, timeout, parse fail, size overflow, non-HTML, blocked IP, CORS in browser) return `null`. The sender's send path proceeds without `embeddedMedia` for that URL. No retry. No user-facing error surface — silent fallback to plain link is the correct UX. A single `console.warn` at the IPC boundary logs the failure reason (no URLs, no PII).

---

## Data Model

### New `embeddedMedia` entry type

Added to the discriminated union in `quorum-shared/src/types/postMessage.ts` (or equivalent):

```ts
{
  type: 'link-preview',
  key: string,             // sanitized URL, unique within the message
  data: string,            // base64 image, empty string if text-only
  mimeType: string,        // 'image/jpeg' or '' for text-only

  // New fields, only set for link-preview entries:
  title: string,
  description?: string,
  siteName?: string,
  originalUrl: string,     // the URL as the user typed it, for click-through
}
```

Existing entry types (`youtube-thumbnail`, `image`, `image-thumbnail`) ignore the new fields. Backward-compatible: existing iteration sites ([Message.tsx:449](../../src/components/message/Message.tsx#L449), [MessagePreview.tsx:288](../../src/components/message/MessagePreview.tsx#L288), [embeddedMedia.ts:14](../../src/utils/embeddedMedia.ts#L14)) use explicit `entry.type === ...` checks, so older clients silently skip unknown `link-preview` entries with no errors.

### Helper in `embeddedMedia.ts`

Extend [src/utils/embeddedMedia.ts](../../src/utils/embeddedMedia.ts) with:

```ts
export function getEmbeddedLinkPreviewEntries(
  content: EmbeddedMediaContent | undefined | null
): LinkPreviewEntry[];
```

Returns full entries (title, description, etc.), not just data URIs — receivers need all the metadata fields, not just bytes.

The existing `getEmbeddedMediaSrc` helper is reused for building the image data URI from `data` + `mimeType`.

---

## Composer UX

### Pre-fetch trigger

A new hook `useLinkPreview(text)` lives alongside `useMessageComposer` and watches `pendingMessage`:

- **500 ms debounce** on text changes.
- After the debounce, extract the first standalone URL using the rules above.
- If a URL is present **and** `window.electron.fetchLinkPreview` exists → kick off the fetch via an abortable promise.
- State machine: `idle | fetching | ready | failed | suppressed`.
- URL changes (user edits): abort in-flight, start new fetch for new URL.
- URL removed: abort, clear cached preview.
- Cache key = sanitized URL string. Same-URL re-paste within a session reuses cache without re-fetching. Cache: in-memory, LRU of 5 entries, dropped on app close.

### Composer UI

- When state = `fetching` or `ready`, render a `LinkPreviewCard` **above the message composer** — same surface region used by reply previews and attached-image previews today. Implementation will match the existing pattern used by those affordances.
- The card has an **X button** in its top-right corner. Clicking X → state = `suppressed` (URL-keyed). Cached entry is kept but not embedded into the outgoing message. If the user later deletes the URL and types a different one, the new URL gets a fresh non-suppressed fetch.
- `fetching` state: skeleton/placeholder card with spinner, dimensions matched to the loaded card so the composer doesn't jump.
- `failed` state: no card rendered.

### Send-time race handling

On submit, `useMessageComposer` calls `await getLinkPreviewOrTimeout()` from the hook:

| Hook state at submit | Behavior |
|---|---|
| `ready` | Return preview entry immediately. |
| `suppressed` | Return `null`. |
| `fetching` | Wait up to **2 seconds**. On completion → return entry. On timeout → return `null`. |
| `failed` or `idle` | Return `null`. |

During the 2s wait the existing `isSubmitting` indicator on the send button covers the UX — the user cannot distinguish this from a normal slow send.

The preview entry, if present, is appended to `embeddedMedia` alongside any image/YouTube entries. Existing send logic in [useMessageComposer.ts:178-259](../../src/hooks/business/messages/useMessageComposer.ts#L178-L259) is **extended, not rewritten** — the combined-vs-text-only branches keep their shape.

---

## Receive-Side Render

### New component: `LinkPreviewCard`

Location: `src/components/ui/LinkPreviewCard.tsx`

```tsx
interface LinkPreviewCardProps {
  imageSrc: string | null;   // data URI from getEmbeddedMediaSrc, or null for text-only
  title: string;
  description?: string;
  siteName?: string;
  originalUrl: string;
}
```

- Pure presentational. No fetching. No external requests.
- Layout: hero image on top (when present), title / description / site name below.
- Full card clickable: opens `originalUrl` in a new tab with `target="_blank" rel="noopener noreferrer"` (matches existing link behavior in [MessageMarkdownRenderer.tsx](../../src/components/message/MessageMarkdownRenderer.tsx)).
- If `imageSrc` is null → text-only variant (no image area).
- Sizing constraints: `max-width: 560px`, responsive, similar to `.youtube-embed` rules in [Message.scss](../../src/components/message/Message.scss).

### Integration in `Message.tsx`

After the markdown body is rendered, iterate `embeddedMedia` once more and render any `link-preview` entries via `LinkPreviewCard`. Render order: markdown body → image attachments → link previews → YouTube embeds (final order TBD in implementation; not blocking).

The standalone-URL detection in the markdown renderer continues to treat URLs as plain links — the markdown body itself does not render the preview; `Message.tsx` does. This keeps the markdown renderer simple and reuses the exact pattern already established for image+thumbnail entries.

### Integration in `MessagePreview.tsx` (pinned messages panel)

Add `LinkPreviewCard` rendering analogous to today's `videoUrl`/`YouTubeEmbed` handling, but wrap the card so click navigates to the message rather than the URL.

### Defensive rendering

Malformed `link-preview` entries (missing required `title`, oversize image, etc.) are skipped at render time. `LinkPreviewCard` defends against bad input with null checks. A bad entry must never break the message render.

---

## Edit Behavior (Interim)

This spec **does not modify the edit path**. Editing a message's text in this spec:

- Does not re-fetch preview metadata.
- Does not modify the message's `embeddedMedia` array.

Concretely: if the user sends a message with a URL preview and later edits the text to remove the URL, the preview lingers. This matches today's behavior for YouTube embeds (which are also not re-evaluated on edit) and is acceptable as an intermediate state.

The follow-up "EditMessage feature parity" spec will solve this properly for all media types (images, YouTube, link previews) in one consistent change.

---

## Open Questions

### Browser support — BLOCKED, needs stakeholder input

In pure browser JavaScript, CORS blocks JS from reading the response body of cross-origin HTML and image fetches for ~95% of websites. There is no client-only workaround.

Four options preserved for review:

**Option 1 — Electron-only feature.** Browser users see plain links. Toggle visible only in Electron build. Cleanest, no server changes, no new metadata leak. May push users toward Electron.

**Option 2 — Quilibrium-run dumb forward proxy.** `api.quorummessenger.com` adds a `/fetch-preview` endpoint that forwards an HTTP GET and returns raw bytes. Sender's client calls it, parses OG, embeds. Server sees URLs being previewed (metadata leak) but never sees message content or receivers. Browser parity with Electron. The leak is opt-in (preview toggle is off by default in the follow-up toggle spec).

**Option 3 — User-configurable proxy URL.** Setting field: "Preview fetch proxy URL". Empty by default = no previews. Users paste their own self-hosted or trusted public proxy. Maximally privacy-preserving, realistically near-zero adoption.

**Option 4 — Combined (Quilibrium default + user override).** Quilibrium proxy is the default; advanced users can swap. Disclosed in toggle help text.

**Who should weigh in:** Cassie (Q Founder) — was the lead on the YouTube facade privacy fix. The trade-off here (metadata visibility to Quilibrium-the-company in exchange for browser parity) is a product/policy call.

**Implementation impact:** the fetch utility in the renderer is structured as a swappable interface so any of the four options can slot in later without rewrites. The Electron IPC path is implementation 1 of that interface; a future proxy fetch is implementation 2.

---

## Testing

### Unit tests (Vitest)

- `quorum-shared/src/utils/urlPreview.ts`: tracking-param stripping, scheme/IP allowlist, length cap, standalone-URL extraction.
- `LinkPreviewCard.tsx`: renders with and without image, click opens link with correct `rel` attributes, text truncation at length caps, null-safe rendering of malformed input.
- `useLinkPreview`: state transitions (`idle → fetching → ready`, `ready → suppressed`, abort-on-URL-change), 2s timeout in race handling, cache hit on same URL.

### Integration tests

- Composer end-to-end: type URL → preview appears → X removes → send produces correct `PostMessage` with/without `link-preview` entry.

### Main-process tests

- IPC handler honors size/timeout/redirect/IP limits. Mock responses for each failure mode.
- Image processing: 400×210 max, JPEG q70, 30 KB cap, drops on overflow.

### Manual QA

- Real-world site sampling: Wikipedia, GitHub, major news sites, Mastodon, Bluesky, a known-broken site, a tracker-heavy URL, a long URL, a `localhost` URL.
- Electron + browser builds.
- X-suppress flow.
- Pinned-messages preview render.
- Backward compat: send a `link-preview` entry from a new client, verify older client builds don't crash (skip-on-unknown-type behavior).

---

## Related Work

- **Follow-up: Privacy toggle for previews** — adds a "Generate link previews" toggle to `UserSettingsModal` defaulting to OFF, gating both YouTube embeds and link previews behind a single switch. Owns the migration UX (banner explaining the change to existing users).
- **Follow-up: EditMessage feature parity with send** — extends `EditMessage` to carry `embeddedMedia`, makes the edit composer functionally symmetric with the send composer. Will also fix the interim limitation in [Edit Behavior (Interim)](#edit-behavior-interim) for all media types (images, YouTube, link previews) in one change.
- [youtube-facade-optimization.md](../docs/features/messages/youtube-facade-optimization.md) — the privacy/architecture pattern this spec mirrors.
- [embedded-media-spec.md](.done/2026-03-12-embedded-media-spec.md) — the `embeddedMedia` field's original design.
- [data-management-architecture-guide.md](../docs/data-management-architecture-guide.md) — P2P / E2E architecture context.
- [privacy-first-defaults](D:\.config\.agents\memory\projects\quilibrium\quorum-desktop\privacy-first-defaults.md) — the golden rule this work serves.

---

*Last updated: 2026-05-27*
