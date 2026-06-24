---
type: task
title: "Move image compression config + orchestration into quorum-shared (desktop side)"
status: done
priority: medium
ai_generated: true
created: 2026-06-24
completed: 2026-06-24
related_docs:
  - .agents/docs/features/messages/client-side-image-compression.md
related_tasks:
  - .agents/tasks/2026-06-24-strip-image-exif-metadata-gaps.md
---

# Move image compression config + orchestration into quorum-shared (desktop side)

> **✅ DONE 2026-06-24.** Shipped:
> - **quorum-shared** PR #50 — `imageConfig.ts` + `imageOrchestration.ts` (+ tests), merged.
> - **quorum-desktop** PR #215 — consumes shared via local link; compressorjs adapter injected; new canonical dimensions applied; GIF error-branch bug fixed; banner upload hint corrected to 2:1; feature doc updated. Merged.
> - Dev-tested on desktop: image uploads working normally.
> - **Decided dimensions**: avatar 256, space icon 256, emoji 96, sticker 512, banner 1600×900 (bounding box, displays ~2:1), message attachment 1200.
> - **Follow-up (separate task)**: mobile adoption is blocked on the shared publish + version bump — `quorum-mobile/.agents/tasks/2026-06-24-plug-mobile-into-shared-image-config.md`.
>
> Original plan preserved below for reference.

> **⚠️ AI-Generated**: Verify file paths and numeric values against the repos before implementing. All references checked on 2026-06-24.

## Why

Desktop and mobile both compress images before upload, but they do it with **completely separate code and drifting limits**. There is no shared source of truth, so per-surface dimensions have silently diverged (avatar 123px on desktop vs 512px on mobile; emoji 36px vs 128px; space icon 123px vs the generic 1200px path on mobile). The compression *engines* are inherently platform-specific and must stay so, but the **config/limits and the orchestration logic are platform-agnostic** and should live in `quorum-shared`.

Goal: one source of truth for image limits + orchestration in shared, plugged into both apps, so the two clients stay consistent.

## Workflow (agreed)

1. **Do the work in `quorum-shared`** (this task covers authoring the shared modules).
2. **Plug `quorum-desktop` into shared** — desktop depends on shared via `link:../quorum-shared` ([package.json](../../package.json), symlinked in `node_modules/@quilibrium/quorum-shared`), so it consumes new shared code **immediately**, no publish needed.
3. **Mobile is gated on a shared publish** — mobile is on a published version (`@quilibrium/quorum-shared@2.1.0-32`). A separate mobile task ([quorum-mobile/.agents/tasks/2026-06-24-plug-mobile-into-shared-image-config.md](../../../quorum-mobile/.agents/tasks/2026-06-24-plug-mobile-into-shared-image-config.md)) implements the mobile side **only after** shared is published and mobile's version bumped.

## Architecture: three tiers

Confirmed feasible against shared's build (tsup, `.web`/`.native` extension-resolution split; pure-TS constants already live in `src/utils/validation.ts`).

### Tier 1 — pure config/types → SHARE (zero risk)
New file **`quorum-shared/src/utils/imageConfig.ts`** (no DOM, no native imports; export from `src/utils/index.ts`):
- `FILE_SIZE_LIMITS` (MAX_INPUT_SIZE, MAX_GIF_SIZE, MAX_EMOJI_INPUT_SIZE, MAX_STICKER_GIF_SIZE, MAX_EMOJI_GIF_SIZE).
- `ImageConfig` interface (maxWidth, maxHeight, quality, cropToFit/maintainAspectRatio, skipCompressionThreshold, gifSizeLimit, preserveGifAnimation, thumbnailConfig).
- `IMAGE_CONFIGS` object (avatar, spaceIcon, spaceBanner, messageAttachment, emoji, sticker).
- `ImageConfigType`, `getImageConfig(type)`, plus `ImageProcessingOptions` / `ProcessedImage` types.

Source to lift from: desktop `src/utils/imageProcessing/config.ts` and `types.ts` (these are already clean pure-TS).

### Tier 2 — orchestration → SHARE via injected compressor
New file **`quorum-shared/src/utils/imageOrchestration.ts`** (pure TS, no split needed):
```ts
export async function processImageWithConfig<T>(
  input: { size: number; mimeType: string },
  type: ImageConfigType,
  compress: (opts: ImageProcessingOptions) => Promise<T>
): Promise<T>
```
Contains: input-size validation against `FILE_SIZE_LIMITS`, GIF-vs-static routing, GIF size check against `config.gifSizeLimit`, thumbnail decision against `thumbnailConfig.threshold`. The actual pixel-pushing is the injected `compress` callback. Pattern precedent: `FileUpload.web.tsx`'s existing `onProcessImage` injection slot.

### Tier 3 — engine → STAYS per-platform (never shared)
- Desktop: `compressorjs` (HTMLCanvasElement / `new Image()` / `URL.createObjectURL`) in `compressor.ts`, `gifUtils.ts`. DOM-only.
- Mobile: `expo-image-manipulator` (`manipulateAsync`) + `expo-file-system`. Native-only.
Each app keeps a thin `compress(opts)` adapter that the shared orchestrator calls.

## ⚠️ OPEN DECISION before coding: canonical dimensions

The per-surface output dimensions currently DIFFER between platforms and must be reconciled to ONE canonical value per surface before `IMAGE_CONFIGS` is authored.

### The deciding principle

Desktop's numbers are NOT arbitrary — the config comments document them as **~1.5× the display size** for retina crispness (avatar `123px output → 82px display`; emoji `36px → 24px display`; banner `450×253 → 300×120 display`). Mobile's larger numbers (avatar 512, emoji 128) appear over-provisioned.

But "just copy desktop" is wrong too: **phones run at higher pixel density (DPR 2–3) than desktops (DPR 1–2)**, so for the same logical display size mobile legitimately needs a somewhat larger source. The right rule is:

> **canonical output resolution = (max logical display size) × (peak device pixel ratio ≈ 3) — then capped for storage cost.**

This gives one source resolution that's crisp on the densest mobile screen AND on desktop retina, without paying for resolution no surface can ever show.

### Canonical values — ✅ DECIDED 2026-06-24

Avatar **256×256**, Space icon **256×256**, Emoji **96×96**, Banner **1600×900 (16:9, crop at render)**, Sticker **512 longest-axis**, Message attachment **1200×1200**. GIF caps and max-input unchanged. Table below retains the rationale.

### Recommended canonical values (now decided — see above)

| Surface | Display size | Desktop today | Mobile today | **Recommended canonical** | Rationale |
|---|---|---|---|---|---|
| Avatar | ~40–82px | 123×123 | 512×512 | **256×256** | 82px display × 3 DPR ≈ 246; 256 is the clean power-of-two. Desktop's 123 is too soft on 3× phones; mobile's 512 is 2× more than any surface shows. |
| Space icon | ~82px | 123×123 | (1200 generic) | **256×256** | Same display role as avatar; mobile currently has NO real icon limit (routes through the 1200 message path) — a bug to fix here. |
| Emoji | 24×24 | 36×36 | 128×128 | **96×96** | 24px × 3 DPR = 72; round to 96 for headroom + occasional larger render (emoji picker preview). Mobile's 128 is fine too if picker shows them bigger — confirm picker size. |
| Sticker | 300px max | 400×600 | 512 (longest) | **512 (longest axis)** | 300px display × ~1.7 effective; mobile's 512 is already sensible. Use longest-axis cap (not fixed W×H) to preserve aspect. Drop desktop's 400×600 fixed box. |
| Space banner | desktop ~300×132 sidebar strip; mobile full-width × 180px strip; **future: discover hero ~900–1200px+** | 450×253 (16:9) | (none — reuses 1200×1200 attachment config) | **1600×900 (16:9), `maintainAspectRatio` (no upload crop), crop at render** | Store clean 16:9, let each surface `cover`-crop. Size for the largest future consumer (discover hero). Desktop's aspect is right, resolution is too small. See note. |
| Message attachment | up to ~1200 | 1200×1200 | 1200×1200 | **1200×1200** | Already aligned. Largest surface; full-view zoom justifies 1200. Keep. |

GIF caps (message 2MB / sticker 750KB / emoji 100KB) and max-input (25MB / emoji 5MB) **already match** across platforms — keep as-is.

### Space banner: same wide aspect, very different absolute size (confirmed 2026-06-24)
Both platforms have a banner surface (the header strip above the channel list), and both render it as a **wide ~2.2–2.4:1 landscape strip** — so the aspect is effectively the SAME. The difference is absolute size, driven by layout:

- **Desktop**: the banner is the top of the **narrow left channel-list sidebar**, not a full-width hero. Sidebar width is `--sidebar-left-width: 260px` (→ `300px` on wide screens) ([src/styles/_base.scss:27,52](../../src/styles/_base.scss)); banner height is `132px` ([src/components/space/ChannelList.scss:38](../../src/components/space/ChannelList.scss)). Display box ≈ **300×132 (~2.3:1)**. (The config comment says "16:9 / 450×253" — the source is fine, but the "16:9" label is slightly off; the real box is ~2.3:1. Worth correcting the comment.)
- **Mobile**: the banner is **full device width × 180px**, `cover` ([quorum-mobile/components/SpaceBannerHeader.tsx:11,167](../../../quorum-mobile/components/SpaceBannerHeader.tsx)). On a ~400pt phone at DPR 3 ≈ **1200×540 displayed (~2.2:1)**. Mobile has NO banner-specific config today — `handlePickBanner` reuses the generic 1200×1200 message-attachment path ([quorum-mobile/components/SpaceSettingsModal.tsx:931-934](../../../quorum-mobile/components/SpaceSettingsModal.tsx)).

Because the aspect matches and mobile is the larger consumer, ONE canonical source works: **size it for mobile's full-width strip (~1200px wide), and desktop's ~300px box downscales from it for free.**

#### ⚠️ Future use: the public-spaces / discover screen wants LARGER banners
The space banner is likely to be reused as a **hero image on the public-spaces (discover) screen**, which is a much bigger display surface than the channel-list strip:
- Desktop discover already renders a wide hero ([src/components/discover-page/SpaceCard.tsx:115-136](../../src/components/discover-page/SpaceCard.tsx)), card width up to `56rem` ≈ **896px** ([DiscoverPage.scss:23](../../src/components/discover-page/DiscoverPage.scss)). Today it uses a blurred-icon hero, NOT a real banner — but a space banner would naturally slot in here.
- Mobile discover ([quorum-mobile/app/(tabs)/spaces/discover.tsx](../../../quorum-mobile/app/(tabs)/spaces/discover.tsx)) is functional but currently shows "No spaces found"; a full-bleed hero there would be ~**1200px+ at DPR 3**.

A banner is uploaded ONCE and must serve the largest consumer it will ever have, because re-uploading later is not an option for existing spaces. So size the canonical for the discover hero, not the tiny sidebar strip.

#### Aspect ratio: store a clean 16:9 and crop at render (best practice)
Don't store the tight ~2.2:1 of the current render boxes. Store a **standard 16:9** source (the "video cover" / OG-image proportion the banner originally used — desktop's `450×253` is exactly 16:9) and let each surface `cover`-crop to its own box. Rationale:
- **`cover` already crops at render** on both platforms (CSS `object-fit: cover` / RN `resizeMode="cover"`), so the source aspect need not match any display box — it just center-crops. A 16:9 source in today's wider 2.2:1 strips loses only a thin sliver top/bottom.
- **16:9 is the safe superset.** It's taller than every current strip, so it can crop DOWN to any of them, AND it can serve a future 16:9 discover hero or a taller card. Storing the tight 2.2:1 instead would lock us out of any taller surface — you can't un-crop later.
- **It matches user expectation** (people grab a 16:9 thumbnail/screenshot for a "cover") and makes the picker preview look natural.
- **Don't hard-crop at upload.** Keep `maintainAspectRatio` (downscale, cap the long edge), so the stored source retains maximum information and each surface — channel-list strip, mobile strip, future discover hero — crops to its own box at render. (If we later want a guaranteed 16:9 stored frame, switch to a 16:9 `cover` crop at upload, but render-time crop is more flexible.)

**Revised recommendation: `spaceBanner` = 1600×900 (16:9), `maintainAspectRatio` (no upload crop), quality 0.8.** Covers a full-width mobile discover hero at 3× and a ~900px desktop discover card with headroom; the 300px channel-list strip and ~400px mobile strip downscale + crop for free. Desktop's current 450×253 is the right ASPECT but far too small in resolution — bump to 1600×900. Confirm 1600×900 vs 1920×1080 with the lead based on how prominent the discover hero will be.

### Open sub-questions for the lead to confirm
1. Is mobile's avatar deliberately 512 for a large profile-header render? If a full-screen profile avatar exists on mobile, 256 may be too small → consider 384.
2. Emoji picker preview size on each platform — if emoji render larger than 24px anywhere, bump the canonical accordingly.
3. Space banner source resolution + the no-crop-at-upload approach above (1600×900 vs 1920×1080).
4. Storage/bandwidth budget: these are per-upload, multiplied across all users. The recommendation already errs toward the smaller defensible value; the lead can trade up for quality or down for cost.

**This is a product/lead call.** The table is a reasoned default, not a mandate — settle the values before authoring shared `IMAGE_CONFIGS`.

## Desktop plug-in steps (after shared modules exist)

1. Replace desktop `src/utils/imageProcessing/config.ts` + `types.ts` contents with re-exports from `@quilibrium/quorum-shared` (keep the file as a thin shim if other desktop code imports from that path).
2. Refactor `unifiedProcessor.ts` to call shared `processImageWithConfig`, passing a desktop `compress` adapter that wraps the existing `compressImage` (compressorjs).
3. Keep `compressor.ts` / `gifUtils.ts` as the desktop engine.
4. Verify all surfaces still work: avatar, space icon, space banner, message attachment (+ thumbnail), emoji, sticker.

## 📄 MUST update the feature doc on completion

The canonical reference for this feature is [.agents/docs/features/messages/client-side-image-compression.md](../docs/features/messages/client-side-image-compression.md). It currently documents the OLD per-surface limits and the OLD desktop-only architecture. When the new sizes/architecture land, update it (otherwise it documents stale dimensions):

1. **"Compression Targets & GIF Handling" table (lines ~48-55)** → replace with the new canonical limits (avatar 256, space icon 256, emoji 96, sticker 512, banner 1600×900 16:9, etc. — final values per the decision above). Update the "Display Size" column too.
2. **"Architecture / Core Files" (lines ~19-29)** → config + orchestration now live in `quorum-shared` (`src/utils/imageConfig.ts`, `imageOrchestration.ts`); desktop keeps only the engine (`compressor.ts`, `gifUtils.ts`) + a thin `compress` adapter. Note the local `link:` consumption.
3. **"File Size Limits" (lines ~140-153)** and **error-message strings (lines ~157-162)** → reconcile with any changed input/GIF caps.
4. **"Mobile (📱 Planned)" section (lines ~178-182)** → rewrite: mobile now shares the SAME config via published `@quilibrium/quorum-shared`; fix the stale task pointer (`mobile-image-compression.md`) to point at [quorum-mobile/.agents/tasks/2026-06-24-plug-mobile-into-shared-image-config.md](../../../quorum-mobile/.agents/tasks/2026-06-24-plug-mobile-into-shared-image-config.md).
5. **"Single source of truth" claim (line ~194)** → now literally true cross-platform; reword to reflect shared ownership.
6. Update the doc's `updated:` frontmatter date and the trailing `*Verified: …*` line.

Consider whether this doc should MOVE to (or be mirrored in) quorum-shared once the logic lives there — at minimum cross-link it.

## Fold in these incidental bugs found during analysis (2026-06-24)

- **Desktop `gifProcessor.ts:27`**: checks `config.gifSizeLimit === 500 * 1024` ("Sticker GIFs") but sticker's limit is `750 * 1024` — branch unreachable, oversized sticker GIFs fall through to the generic error.
- **Desktop `GIF_THUMBNAIL_THRESHOLD` (500KB, config.ts:18)**: dead constant — the GIF thumbnail trigger actually uses `thumbnailConfig.threshold * 1024` (300KB). Reconcile or remove.
- **Desktop strict/skip EXIF passthrough**: tracked separately in [2026-06-24-strip-image-exif-metadata-gaps.md](2026-06-24-strip-image-exif-metadata-gaps.md) — coordinate, since both touch `compressor.ts`/`config.ts`.

## Acceptance

- `quorum-shared` exports `IMAGE_CONFIGS`, `FILE_SIZE_LIMITS`, types, and `processImageWithConfig` with no DOM/native imports (builds clean for both web and native bundles).
- Desktop consumes shared config + orchestration via the local link; all six surfaces produce identical output to before (modulo any agreed dimension changes).
- The dimension table above is resolved to single canonical values.
- A follow-up shared publish + version bump is scheduled so the mobile task can proceed.

## Notes

- Surfaced during a quorum-mobile open-PR cleanup (2026-06-24) while comparing desktop vs mobile image handling.
- Shared publish is lead-gated; these are additive pure-TS exports, shippable on the next bump.
- Error strings, if moved to shared, go as error KEYS (shared has no i18n; desktop uses `@lingui`). Match the existing `errorKey` pattern in shared's validation layer.

*Last updated: 2026-06-24*
