---
type: task
title: "Decentralized GIF Library on Quilibrium"
status: open
complexity: high
ai_generated: false
reviewed_by: null
created: 2026-02-24
updated: 2026-02-24
related_tasks: []
related_docs: []
---

# Decentralized GIF Library on Quilibrium

## Vision

Build a **decentralized GIF library that lives on Quilibrium's network** — similar to what Giphy is, but privacy-first and decentralized. The library serves as infrastructure: other apps can integrate with it to show GIFs to their users, just like apps today integrate with Giphy/Tenor. The key difference is that **no user data is collected or read** — search queries, usage patterns, and user identity remain completely private.

This is NOT a stock media service. This is a public GIF search/discovery platform, decentralized and open.

## Why Build This

1. **Every existing GIF API is a privacy nightmare.** Giphy shares data with 816 advertising partners. Tenor is shutting down. Klipy has ethical red flags. Any centralized API inherently sees user queries.
2. **The market has a gap.** With Tenor dying (June 30, 2026) and Giphy behind a paywall ($900-9K/yr), there's no good free, privacy-respecting GIF API left.
3. **Quilibrium is uniquely positioned.** The decentralized network already solves the hard infrastructure problems (storage, distribution, censorship resistance).

## Third-Party APIs: Why They're All Out

| Provider | Verdict | Reason |
|----------|---------|--------|
| **Giphy** | Not viable | $900-9K/yr, 816 ad partners, tracks everything |
| **Tenor** | Dead | Shutting down June 30, 2026 |
| **Klipy** | Not viable | Astroturfing scandal, bulk-scraped Tenor, FTC complaint filed |
| **heypster** | Too expensive | 399 EUR/mo for self-hosted tier, still a catalog dependency |

**Fundamental problem:** Any third-party GIF API — by definition — sees your users' search queries. No way around it with an external service.

## Content Sources

**Existing public domain and CC-licensed content**. 

### Viable Sources

| Source | Count | License | Notes |
|--------|-------|---------|-------|
| **Wikimedia Commons** | ~36,500 | CC / Public Domain | MediaWiki API via `Category:Animated_GIF_files`. Educational/scientific content. |
| **Openverse / Flickr CC** | ~15,000-65,000 | CC (various) | Heavy overlap with Wikimedia. Flickr often strips GIF animation. |
| **NARA** | ~1,200-2,000 | US Gov Public Domain | High quality historical. Currently on Giphy — source originals directly. |
| **NASA** | ~200-500 | US Gov Public Domain | Small but quality space/science content. |

### Not Viable

| Source | Why |
|--------|-----|
| **Pixabay** (~10K GIFs) | GIFs blocked from API. Restrictive license since 2019. |
| **Pexels** | Zero GIFs — photos and videos only. |
| **GifCities** (1.6M GIFs) | Unresolved copyright. ~90% is 1990s web junk. |
| Web scraping / Reddit / Tumblr / Imgur | Illegal or ToS prohibit redistribution |

### Future Growth

- **Prelinger Archives** (video-to-GIF extraction) — ~30,000-65,000 potential GIFs from ~5,500 public domain films. Requires building an extraction pipeline.
- **Community contributions** — users create and upload GIFs within the Quilibrium network. This is how Tenor originally built its catalog. **The real long-term growth path** for getting the reaction/meme GIFs people actually want in chat.

### Catalog Size Estimates

| Scenario | Unique GIFs (after dedup) |
|----------|--------------------------|
| **Launch (CC/PD sources only)** | **~40,000-80,000** |
| **+ Prelinger extraction** | **~70,000-145,000** |
| **+ Community (year 1)** | **~80,000-200,000+** |

**Reality check:** Giphy has hundreds of millions. The open/free GIF ecosystem is orders of magnitude smaller. The 50K launch target is achievable from CC/PD sources alone, but the library will be heavily educational/scientific — not the reaction GIFs people search for in chat. Community contributions are essential for making the library actually useful.

## Architecture

### Storage
Quilibrium network as the primary storage and distribution layer. Content-addressed (like IPFS) so GIFs are immutable and verifiable. Distributed across the network — no single point of failure, no central CDN.

### Search / Discovery
CLIP embeddings (open source, runs locally) for semantic search — users type text, get matching GIFs. Community-contributed tags in a decentralized index. MeiliSearch or Typesense as the search engine component.

### API
Open API that any app can integrate with. No API keys required (or optional for rate limiting — no tracking). SDKs for React, iOS, Android.

### Privacy Guarantees
- Zero data collection — no IPs, no device IDs, no search history
- Search queries stay on-device or within encrypted network
- No advertising, no tracking, no behavioral profiling
- No mandatory branding

## Deduplication Strategy

Aggregating from multiple sources will produce significant overlap, especially between Wikimedia and Openverse. Deduplication runs as a multi-stage pipeline during ingestion — cheapest checks first, expensive checks only when needed.

### Stage 1: SHA-256 (exact hash)
Catches byte-identical files from different sources. Trivial to implement. Expected to catch **5-15%** of cross-source duplicates.

### Stage 2: pHash (perceptual hash)
The main workhorse. Converts visual content into a 256-bit fingerprint. For animated GIFs, sample 5 evenly-spaced frames and hash each independently. Catches different resolutions, compression levels, frame rates, minor color changes. Threshold: Hamming distance <= 20. Indexed in FAISS for fast lookup. Expected to catch an **additional 10-25%**.

Key libraries: `imagehash`, `imagededup`, `phash-gif` (Node.js), FAISS for indexing.

### Stage 3: CLIP similarity (optional)
Cosine similarity >= 0.92 on semantic embeddings. Catches watermarks, text overlays, heavy crops that pHash misses. Reuses the same CLIP embeddings from the search layer. Another **5-10%** on top.

### Results
**Combined accuracy:** 95-97% of true duplicates caught, 1-2% false positive rate. **Recommendation:** Start with stages 1+2 only — catches 80-90% of duplicates. Add CLIP only if needed.

**Version selection:** When duplicates are found, keep highest resolution, most frames, cleanest (no watermark), most permissive license (CC0 > CC-BY > CC-BY-SA).

## Content Pipeline

```
1. Bulk download from CC/PD sources (Wikimedia, Openverse/Flickr CC, NARA, NASA)
           |
2. Deduplicate (SHA-256 → pHash → CLIP similarity)
           |
3. Select best version of each duplicate group
           |
4. Normalize formats, optimize file size
           |
5. Generate CLIP embeddings + text tags
           |
6. Upload to Quilibrium network (content-addressed)
           |
7. Index in search layer → Available via open API
```

For incremental ingestion, each new GIF checks against the existing index before admission (milliseconds per GIF).

## Licensing

| License | Redistribute | Commercial | Attribution |
|---------|-------------|------------|-------------|
| CC0 / Public Domain | Yes | Yes | No |
| CC-BY | Yes | Yes | Yes |
| CC-BY-SA | Yes (same license) | Yes | Yes |
| US Gov PD (NARA/NASA) | Yes | Yes | No |

All content tracks its license in metadata so downstream apps can display attribution where required.

## Open Questions

- **Content moderation** — How to handle inappropriate content in a decentralized system?
- **Trending/Popular** — How to surface popular GIFs without tracking usage?
- **Content growth** — How to grow beyond the CC/PD catalog? Community uploads? Creator partnerships?

## Success Criteria

1. 50K+ searchable GIFs at launch
2. Search results in <200ms
3. Zero user data collected
4. At least one third-party app integrates
5. 100% legally clear content (all licenses tracked)

---

_Created: 2026-02-24_
_Updated: 2026-02-24_
