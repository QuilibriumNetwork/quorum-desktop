---
type: report
title: "Complete i18n Translation Quality Audit"
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_tasks:
  - .agents/tasks/2026-03-14-i18n-complete-translation-quality-audit.md
related_docs:
  - .agents/reports/.archived/i18n-translation-quality-audit_2026-03-14.md
---

# Complete i18n Translation Quality Audit

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary

Follow-up audit covering 16 social-app concepts across all 30 language PO files, extending the prior partial audit (Thread, Space, Pin, Emoji). Found and fixed issues in **4 languages** across **5 issue categories**: French Channel inconsistency, Serbian Mute/Unmute root mismatch, Portuguese Mute/Unmute inconsistency, Portuguese Bookmark/Favorites terminology confusion, and Swedish Sticker wrong word.

## Scope & Methodology

- **Scope**: All 30 language files in `src/i18n/*/messages.po`
- **Methodology**: Automated grep of all msgid/msgstr pairs for 16 concepts, cross-language comparison against the language category framework, semantic review of translations
- **Concepts audited**: Channel, Reaction, Mention, Mute/Unmute, Role, Ban/Unban, Admin/Administrator, Status, Direct Message/DM, Notification, Invite/Invitation, Member/Members, Bookmark/Bookmarks, Sticker/Stickers, Owner, Draft/Drafts
- **Language category framework**: Same as prior audit (Keep English: de/id/fi/nl/no/da/sv; Transliterate: ja/ko; Translate natively: all others)

## Findings & Fixes Applied

### 1. French Channel — "chaîne" vs "canal" inconsistency

**Issue**: 4 out of ~30 Channel-related strings used "chaîne" (TV channel/chain) instead of "canal" (communication channel). The rest of the file consistently used "canal".

**Fix**: Standardized all to "canal":

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"Channel Name"` | `"Nom de la chaîne"` | `"Nom du canal"` |
| `"Channel Topic"` | `"Sujet de la chaîne"` | `"Sujet du canal"` |
| `"Default Channel"` | `"Chaîne par défaut"` | `"Canal par défaut"` |
| `"Delete Channel"` | `"Supprimer la chaîne"` | `"Supprimer le canal"` |

### 2. Serbian Mute/Unmute — inconsistent verb roots

**Issue**: Mute strings used two different roots — "utišati" (silence) for user-specific actions and "isključiti" (turn off) for channel/space actions. Unmute strings all used "uključiti" (turn on), which pairs with "isključiti" but not "utišati".

**Fix**: Standardized to "isključi/ponovo uključi" pairing throughout:

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"Mute"` | `"Utišavanje"` | `"Isključi zvuk"` |
| `"Mute User"` | `"Utišaj korisnika"` | `"Isključi korisnika"` |
| `"Mute Users"` | `"Utišaj korisnike"` | `"Isključi korisnike"` |
| `"Unmute"` | `"Ponovno uključivanje"` | `"Ponovo uključi zvuk"` |
| `"Unmute User"` | `"Ponovno uključi korisnika"` | `"Ponovo uključi korisnika"` |

### 3. Portuguese Mute/Unmute — mixed Unmute terminology

**Issue**: Mute side was consistent ("Silenciar" everywhere), but Unmute mixed three different forms: "Ativar som" (standalone), "Desmutar" (Channel/Space), and "Ativar Som na" (Conversation).

**Fix**: Standardized all Unmute strings to "Reativar som" which pairs cleanly with "Silenciar":

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"Unmute"` | `"Ativar som"` | `"Reativar som"` |
| `"Unmute Channel"` | `"Desmutar Canal"` | `"Reativar som do Canal"` |
| `"Unmute Conversation"` | `"Ativar Som na Conversa"` | `"Reativar som da Conversa"` |
| `"Unmute Space"` | `"Desmutar Espaço"` | `"Reativar som do Espaço"` |
| `"Unmute User"` | `"Ativar som do Usuário"` | `"Reativar som do Usuário"` |

### 4. Portuguese Bookmark — "Favorito" vs "Marcador" confusion

**Issue**: Standalone `"Bookmark"` was translated as "Favorito" (Favorite), but `"Bookmarks"` and all compound bookmark strings used "Marcador/Marcadores". The app has a separate "Favorites" feature that correctly uses "Favoritos", making this a terminology collision.

**Fix**: Changed standalone Bookmark and its compound string to use "Marcador":

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"Bookmark"` | `"Favorito"` | `"Marcador"` |
| `"Bookmark limit reached!..."` | `"Limite de favoritos..."` | `"Limite de marcadores..."` |

### 5. Swedish Sticker — wrong word entirely

**Issue**: `"Stickers"` was translated as `"Klippor"` which means "clips/snippets" in Swedish — semantically wrong.

**Fix**: Changed to "Klistermärken" (the correct Swedish word for stickers):

| msgid | Was | Fixed to |
|-------|-----|----------|
| `"Stickers"` | `"Klippor"` | `"Klistermärken"` |

## Concepts Verified Clean (No Issues Found)

| Concept | Notes |
|---------|-------|
| **Reaction / Reactions** | All Slavic and CJK languages use correct native terms |
| **Mention / Mentions** | All "translate natively" languages properly translate |
| **Role / Roles** | zh-CN consistently uses 角色; ru/uk consistent |
| **Ban / Unban** | No msgids found — app uses "Kick" terminology instead |
| **Admin / Administrator** | Consistent usage within all language files |
| **Status** | ru/uk use "онлайн-статус" for presence and "статус" for generic — correct contextual distinction |
| **Direct Message / DM** | All languages properly translate or transliterate |
| **Notification / Notifications** | Slavic plural forms all correct (cs "oznámení" is same form for both — grammatically correct) |
| **Invite / Invitation** | Action vs noun consistency maintained across all languages |
| **Member / Members** | Complex morphology languages (ru, pl, cs, ar) all use correct case/number agreement |
| **Owner** | No standalone msgid — only appears in compound strings, all correct |
| **Draft / Drafts** | No msgids found — feature not yet implemented |

## LLM Prompt Updates

Added per-language rules to `D:/GitHub/toolmix/tools/text/po-file-translator/LLM-prompt.txt` for:
- **Channel**: French must use "canal" not "chaîne"
- **Mute/Unmute**: Serbian and Portuguese consistency rules
- **Bookmark**: Portuguese must use "Marcador" not "Favorito"
- **Sticker**: Swedish must use "Klistermärken" not "Klippor"

## Related Documentation

- Prior audit: `.agents/reports/.archived/i18n-translation-quality-audit_2026-03-14.md`
- Task: `.agents/tasks/2026-03-14-i18n-complete-translation-quality-audit.md`
- LLM prompt: `D:/GitHub/toolmix/tools/text/po-file-translator/LLM-prompt.txt`
- PO files: `src/i18n/*/messages.po`

---

*Created: 2026-03-14*
*Report Type: Audit*
