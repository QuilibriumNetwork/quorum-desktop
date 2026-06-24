---
type: task
title: "Close EXIF/metadata stripping gaps on image uploads"
status: pending
priority: medium
ai_generated: true
created: 2026-06-24
related_docs:
  - .agents/docs/features/messages/client-side-image-compression.md
---

# Close EXIF/metadata stripping gaps on image uploads

> **⚠️ AI-Generated**: Verify the compressorjs behaviour against the installed version before implementing. All file:line references checked against the repo on 2026-06-24.

## Why

Photos taken on a phone embed **EXIF metadata** that can include **GPS coordinates**, capture time, and the camera/device model. For a privacy-focused messenger, uploading that raw metadata leaks the user's location.

Desktop already has the right intent and a good architecture: every image upload (avatar, space icon, banner, emoji, sticker, message attachment) routes through one shared utility, `src/utils/imageProcessing/compressor.ts`, which sets `retainExif: false` ([compressor.ts:103](../../src/utils/imageProcessing/compressor.ts)). For the common case (a normal-sized photo), EXIF is stripped correctly.

But there are **three bypass paths** where a raw file with intact EXIF still reaches the wire. Because every surface shares `compressImage`, fixing the bypass paths in that one file closes the gaps for **all** surfaces at once.

## The three gaps (all verified against current code)

### Gap 1 — Small images skip stripping entirely
[compressor.ts:87-96](../../src/utils/imageProcessing/compressor.ts): if `file.size < skipCompressionThreshold` **and** the image is already within max dimensions, `compressImage` returns the **raw original file** (`wasCompressed: false`) without ever invoking compressorjs — so `retainExif: false` never runs.

Per-surface thresholds ([config.ts](../../src/utils/imageProcessing/config.ts)):

| Surface | skipCompressionThreshold | maxW×maxH |
|---|---|---|
| avatar | 50KB | 123×123 |
| spaceIcon | 50KB | 123×123 |
| emoji | 50KB | 36×36 |
| spaceBanner | 100KB | 450×253 |
| sticker | 100KB | 400×600 |
| message attachment | 100KB | 1200×1200 |

A phone photo of a dark or plain scene can easily land under 50KB while still carrying GPS coordinates. This is the most meaningful gap.

### Gap 2 — compressorjs `strict` passthrough returns the raw file
[compressor.ts:100-122](../../src/utils/imageProcessing/compressor.ts) builds `compressorOptions` but never sets `strict`, so it defaults to `true` (compressorjs 1.3.0, `dist/compressor.common.js:208`).

In the success path ([compressor.common.js:1016](../../node_modules/compressorjs/dist/compressor.common.js)):

```js
// Returns original file if the result is greater than it and without size related options
if (options.strict && !options.retainExif && result.size > file.size
    && options.mimeType === file.type
    && !(/* any dimension is being reduced */)) {
  result = file;  // <-- the ORIGINAL raw file, EXIF intact
}
```

Counter-intuitively, `retainExif: false` is part of what **enables** this passthrough. When the canvas re-encode produces a file larger than the input (common with already-compressed JPEGs) and no dimension reduction is happening, the library hands back the original file. Our `success` callback then wraps it in a new `File` and sets `wasCompressed: true` regardless, so the caller cannot detect the passthrough.

### Gap 3 — Animated GIFs are always sent raw
[gifProcessor.ts:49-55](../../src/utils/imageProcessing/gifProcessor.ts): when `preserveGifAnimation` is set (emoji, sticker, message attachment), the original GIF is returned unchanged. Lower severity (the GIF format has no standardized GPS field) but XMP/comment metadata can still be present.

## Out of scope / non-gaps

- **Farcaster uploads**: desktop's Farcaster page is currently a "coming soon" stub with no upload surface ([FarcasterPage.tsx:25-38](../../src/pages/FarcasterPage.tsx)), so there is no Farcaster-upload leak here. (Mobile did have one — closed in quorum-mobile PR #129.)

## Proposed fix

All in `src/utils/imageProcessing/compressor.ts`:

1. **Gap 2 (cheapest, highest-confidence):** set `strict: false` in `compressorOptions` so the library always returns the re-encoded canvas output (which has no EXIF) instead of the original. Trade-off: an already-compressed JPEG may end up marginally larger. Acceptable for the privacy guarantee.

2. **Gap 1:** either drop `skipCompressionThreshold` to `0` (every static file goes through compressorjs and gets stripped) **or** keep the perf shortcut but add an explicit EXIF-strip pass on the skip path (e.g. a lightweight canvas re-draw, or `piexifjs` remove) before returning the raw file. Dropping the threshold is simpler; measure the perf cost of always re-encoding small avatars/emoji first.

3. **Gap 3:** decide and document. Either accept GIF passthrough as a known low-severity non-gap (no GPS in GIF), or strip XMP from GIFs via a parser before transmission. Recommend: document as accepted; revisit only if perfect coverage is required.

## Acceptance / testing

- A JPEG with GPS EXIF, under the skip threshold and already within dimensions, no longer carries EXIF after going through each surface (avatar, space icon, banner, emoji, sticker, message attachment).
- An already-compressed JPEG that previously triggered the strict passthrough no longer carries EXIF.
- PNG graphics/icons still upload (transparency preserved where applicable); large PNG photos still convert to JPEG as today.
- GIF animation still works on emoji/sticker/attachment.
- Verify by reading EXIF on the uploaded/stored bytes (e.g. `exiftool`), not just visual inspection.

## Notes

- Surfaced during a quorum-mobile open-PR cleanup (2026-06-24) while evaluating winged-pegasus's metadata-stripping draft. Mobile's equivalent gap (Farcaster Cloudflare upload) was fixed in quorum-mobile PR #129.
- The shared-utility architecture here is good — resist re-fragmenting per surface. Keep the fix in `compressor.ts`.

*Last updated: 2026-06-24*
