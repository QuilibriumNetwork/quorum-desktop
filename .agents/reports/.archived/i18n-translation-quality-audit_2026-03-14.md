---
type: report
title: "i18n Translation Quality Audit"
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_tasks: []
related_docs: []
---

# i18n Translation Quality Audit

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary

Performed a cross-language translation quality audit across all 30 PO files in `src/i18n/*/messages.po`, triggered by the thread panel feature translation. The audit focused on social-app concepts where AI translators make systematic errors: keeping English loanwords when a native term exists, or using a semantically wrong native word. Found and fixed issues in **7 languages** across **4 concept categories**.

## Scope & Methodology

- **Scope**: All 30 language files — ar, cs, da, de, el, en-PI, es, fi, fr, he, id, it, ja, ko, nl, no, pl, pt, ro, ru, sk, sl, sr, sv, th, tr, uk, vi, zh-CN, zh-TW
- **Methodology**: Targeted grep of high-risk concepts (Thread, Space, Pin, Emoji), cross-language comparison of msgstr values, semantic review of translations against native-language tech community norms
- **Concepts audited**: Thread/Threads, Space/Spaces, Pin/Pinned, Emoji/Emojis

## Key Insight: Language Categories for Tech Loanwords

Understanding which category a language falls into is essential for auditing AI translations:

| Category | Languages | Pattern |
|----------|-----------|---------|
| **Keep English** | de, id, fi, nl, no, da, sv | Germanic/Scandinavian tech communities accept English terms as-is |
| **Transliterate** | ja, ko | Phonetic adaptation into native script (カタカナ, 한글) |
| **Translate natively** | fr, es, it, pt, ro, ar, zh-CN, zh-TW, pl, cs, sk, sl, sr, he, el, tr, vi, th, ru, uk | Use native-language equivalent concepts |

AI translators tend to fail in two directions: over-translating languages that keep English terms, or under-translating (or wrongly translating) languages that use native terms.

## Findings & Fixes Applied

### 1. Thread strings — ja + sv (translation script failures)

**Issue**: The translation script returned a count mismatch for Japanese (26 instead of 27) and a completely wrong response for Swedish (4 unrelated strings). All 27 thread-related strings were left empty in both files.

**Root cause**: LLM non-determinism in batch translation — the model returned responses for different content than requested.

**Fix**: All 27 strings manually filled for both languages using the correct terms (ja: スレッド loanword; sv: Tråd native word).

### 2. Thread terminology — ko + he (wrong words used)

**Korean (ko)** — 3 strings left in English by the translator:

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"Thread Settings"` | `"Thread Settings"` | `"스레드 설정"` |
| `"Threads"` | `"Threads"` | `"스레드"` |
| `"View Thread"` | `"View Thread"` | `"스레드 보기"` |

**Hebrew (he)** — All 14 thread strings used `"תיוג/תגים"` which means **tag/label**, not thread. The correct Hebrew for a discussion thread is `"שרשור/שרשורים"` (from the word for chain/threading). Additionally, one msgstr (`"No threads yet"`) contained a Korean character `아직` — a clear sign of LLM context confusion across batches.

All 14 strings corrected to use `"שרשור/שרשורים"`.

### 3. "Spaces" plural missing in 5 Slavic/East European languages

These languages had translated "Space" correctly in all compound strings (Create Space, Delete Space, Leave Space, This Space) but the standalone plural `msgid "Spaces"` in the navbar was left as `"Spaces"`. Likely a timing issue where this string was added after the main translation batch ran.

| Language | Was | Fixed to |
|----------|-----|----------|
| ru | `"Spaces"` | `"Пространства"` |
| pl | `"Spaces"` | `"Przestrzenie"` |
| cs | `"Spaces"` | `"Prostory"` |
| sk | `"Spaces"` | `"Priestory"` |
| uk | `"Spaces"` | `"Простори"` |

**Note**: de, sv, fi, nl, no, da, id, th, vi, el keeping `"Spaces"` as an English loanword is intentional and correct for those language communities.

### 4. Pin/Pinned inconsistency — it + de (semantically wrong words)

**Italian (it)** — `"pin"/"Pin"` was translated as `"pinna"/"Pinna"`, which means **fish fin** or **flipper** in Italian. The correct Italian for the pin/fasten action is `"fissa/Fissa"` (from *fissare* = to fix/fasten). The rest of the Italian file already used `"Fissa"` correctly in compound strings. Fixed 4 strings:

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"pin"` | `"pinna"` | `"fissa"` |
| `"Pin"` | `"Pinna"` | `"Fissa"` |
| `"Pin channel to top"` | `"Pinna il canale in cima"` | `"Fissa il canale in cima"` |
| `"Pin Message"` | `"Pinna Messaggio"` | `"Fissa Messaggio"` |
| `"Pin to top"` | `"Pinna in cima"` | `"Fissa in cima"` |

**German (de)** — `"pin"/"Pin"` was translated as `"Stecker"/"Stecker"`, which means **electrical plug/connector**. All other German pin strings correctly used `"anheften"` (to affix). Fixed 2 strings:

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"pin"` | `"Stecker"` | `"anheften"` |
| `"Pin"` | `"Stecker"` | `"Anheften"` |

## Non-Issues (Verified, Left Unchanged)

| Language | Term | Verdict |
|----------|------|---------|
| tr | `"Emojiler"` for Emojis | Turkish grammatical plural — linguistically correct |
| fi | `"Emojit"` for Emojis | Finnish grammatical plural — correct |
| ko | `"이모지"` for Emojis | Standard Korean transliteration — correct |
| zh-CN/TW | `"表情符号"` for Emojis | Established Chinese term — correct |
| zh-TW | `"串聯"` for Thread | Acceptable Taiwanese term (串 = string/series) |
| it | `"Discussione"` for Thread | Acceptable (Discord/Twitter also use this) |
| ru/uk | `"Тема"` for Thread | Standard forum thread term in Russian/Ukrainian |

## Recommendations for Translation Scripts

1. **Retry on count mismatch** — instead of failing the entire batch, retry once before erroring out. A single retry would have caught both the ja and sv failures.

2. **Add same-script character detection** — after translation, check that the output script matches the target language (e.g., no CJK characters in Hebrew output, no Latin in Arabic output). The `아직` Korean character in the Hebrew file is the clearest possible signal of LLM confusion.

3. **Seed prompts with pre-verified core concept translations** — provide the translator with a glossary of known-correct translations for core app concepts (Space, Thread, Pin, Channel, etc.) per language. This prevents the model from "inventing" translations for well-established terms.

4. **Consider a post-translation semantic review pass** — for languages in the "translate natively" category, a second LLM pass asking "does this translation use the correct word for the concept?" would catch wrong-word errors like pinna/Stecker.

## Related Documentation

- `src/i18n/*/messages.po` — all language PO files
- `.agents/docs/features/messages/thread-panel.md` — thread panel feature documentation

---

*Created: 2026-03-14*
*Report Type: Audit*
