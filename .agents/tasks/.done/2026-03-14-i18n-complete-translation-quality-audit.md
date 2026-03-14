---
type: task
title: "Complete i18n Translation Quality Audit"
status: done
complexity: medium
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_docs:
  - .agents/reports/i18n-translation-quality-audit_2026-03-14.md
related_tasks: []
---

# Complete i18n Translation Quality Audit

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/i18n/*/messages.po` — all 30 language files (ar, cs, da, de, el, en-PI, es, fi, fr, he, id, it, ja, ko, nl, no, pl, pt, ro, ru, sk, sl, sr, sv, th, tr, uk, vi, zh-CN, zh-TW)

## What & Why

A prior partial audit (2026-03-14) found issues in 7 languages across 4 concepts: Thread, Space, Pin, Emoji. All were fixed. This task covers the remaining high-risk social-app vocabulary that was not yet audited — wrong words, untranslated strings, and within-file inconsistencies all degrade UX for non-English users.

## Context

- **Prior audit findings**: `.agents/reports/i18n-translation-quality-audit_2026-03-14.md`
- **Language category framework** (critical for knowing when loanwords are correct):
  - **Keep English**: de, id, fi, nl, no, da, sv
  - **Transliterate**: ja (カタカナ), ko (한글)
  - **Translate natively**: fr, es, it, pt, ro, ar, zh-CN, zh-TW, pl, cs, sk, sl, sr, he, el, tr, vi, th, ru, uk
- **Grep pattern**: `grep -A1 'msgid "Channel"' src/i18n/*/messages.po | grep msgstr | sort`
- **Constraint**: Never translate Quorum, Quilibrium, Emoji, Emojis, useWebSocket, WebSocketProvider

## Implementation

### Phase 1: Audit each concept across all 30 languages

For each concept below, grep all 30 files, compare translations against the language category framework, and note issues.

- [x] **Channel / Channels** — widely translated; check fr, es, it, pt use correct word vs. loanword
- [x] **Reaction / Reactions** — fr "Réaction" ok; check Slavic/CJK languages
- [x] **Mention / Mentions** — check if some languages mistakenly keep English loanword
- [x] **Mute / Unmute** — action verbs; check consistency within each language (mute vs. unmute should share root)
- [x] **Role / Roles** — previously flagged: zh-CN "职责" vs "角色"; ru/uk consistency
- [x] **Ban / Unban** — very short words, high risk of wrong translation
- [x] **Admin / Administrator** — check if mixed usage within same language
- [x] **Status** (user online status) — risk of translating as general "status" vs. presence-specific term
- [x] **Direct Message / DM** — "DM" abbreviation: check if kept as-is or expanded
- [x] **Notification / Notifications** — generally safe but check Slavic plural forms
- [x] **Invite / Invitation** — action vs. noun; check consistency
- [x] **Member / Members** — check plural forms in languages with complex morphology (ru, pl, cs, ar)
- [x] **Bookmark / Bookmarks** — some languages may translate as "favorite" instead
- [x] **Sticker / Stickers** — should stay as loanword in most languages (like Emoji); check zh-CN/TW
- [x] **Owner** — role title; check if translated consistently with other role titles
- [x] **Draft / Drafts** — message drafts; check natively-translating languages

### Phase 2: Fix all identified issues

- [x] **Apply fixes** for each confirmed wrong/inconsistent translation
  - Follow the pattern from prior fixes: read file line, Edit with correct translation
  - Fix inconsistencies within same language (e.g. if "Ban" is translated two different ways)

### Phase 3: Update audit report and prompt

- [x] **Update `.agents/reports/i18n-translation-quality-audit_2026-03-14.md`** with new findings
- [x] **Update `LLM-prompt.txt`** (`D:/GitHub/toolmix/tools/text/po-file-translator/LLM-prompt.txt`) if any concepts need explicit per-language rules added (like Space and Thread already have)

## Verification

✅ **No untranslated strings** for audited concepts in natively-translating languages
   - Test: `grep -A1 'msgid "Channel"' src/i18n/*/messages.po | grep 'msgstr "Channel"'` should only return Keep-English languages

✅ **No cross-script contamination**
   - Test: visually scan any new translations for foreign script characters

✅ **Within-language consistency**
   - Test: a concept translated two ways in the same file should not exist

## Definition of Done
- [x] All 16 concepts audited across all 30 languages
- [x] All confirmed issues fixed
- [x] Audit report updated with findings
- [x] LLM-prompt.txt updated if new per-language rules discovered
- [x] Index updated
