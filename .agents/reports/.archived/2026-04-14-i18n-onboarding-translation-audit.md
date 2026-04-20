---
type: report
title: "i18n Onboarding Translation Audit — April 2026"
ai_generated: true
created: 2026-04-14
updated: 2026-04-20
related_tasks: []
related_docs: []
---

# i18n Onboarding Translation Audit — April 2026

> **AI-Generated**: May contain errors. Verify before use.

## Executive Summary

On 2026-04-14, 53 new strings were added to the onboarding flow and translated into all 30 target languages via the automated LLM pipeline (Qwen on OpenRouter). A subsequent quality review by 4 parallel review agents identified 150+ issues across all languages, ranging from critical semantic errors (wrong words, wrong language contamination) to medium-severity inconsistencies (passkey terminology, register mixing). All issues were fixed before compilation.

On 2026-04-20, a **full quality pass** was completed covering all ~877 strings across all 30 languages. Every PO file was reviewed by a native-language subagent, fixing semantic errors, untranslated strings, wrong-language contamination, gender/case agreement, register consistency, and terminology unification. All 30 languages are now fully translated, reviewed, and compiled.

**Scope covered (April 2026 quality pass)**: All ~877 strings × 30 languages = ~26,310 string reviews. Zero untranslated strings remaining.

---

## Scope & Methodology

- **Scope**: 53 new onboarding strings added in `feat/new-onboarding-ui-ux`, translated to 30 languages (ar, cs, da, de, el, en-PI, es, fi, fr, he, id, it, ja, ko, nl, no, pl, pt, ro, ru, sk, sl, sr, sv, th, tr, uk, vi, zh-CN, zh-TW)
- **Methodology**: 4 parallel review agents (grouped by language family) examined every new translation against the English source
- **Tools**: Claude subagents, `po_file_translator.py --count-only`, `npx lingui extract`
- **Date**: 2026-04-14
- **Source files**: `src/i18n/{locale}/messages.po`

---

## Findings by Language

### Critical Issues (fixed)

| Language | Issues Found | Key Problems |
|----------|-------------|--------------|
| Greek (el) | 9 | "device" → "packaging machine" (συσκευαστής); "password" → "outbuilding" (παράκτημα); "access" → "assault"; untranslated string; gender errors |
| Hebrew (he) | 7 | "key" → "shower" (מקלחת) in 2 strings; garbled passkey timeout strings; nonsensical phrases |
| Ukrainian (uk) | 7 | "You're all set!" → "You've edited everything!"; "What should we call you?" → "What should we call ourselves?"; untranslated string |
| Norwegian (no) | 12 | "fingerprint" → "fingervipps" (a payment app name); "passkey" → "passordnøkkel" (password key) throughout; typo "deentralisert" |
| Serbian (sr) | 9 | "Back Up" → "Progress" (Napredak); systematic wrong genitive "naloge" (should be "naloga"); "cancelled" → "unhooked" |
| Finnish (fi) | 8 | "passkey" → "salakulkutunniste" (smuggling identifier); "avainteesi" not a real word; wrong verb mood |
| Slovenian (sl) | 7 | Serbian/Croatian contamination in 2 full strings; "passkey" → "geslo" (password); "decentralized" → "open" |

### High Severity Issues (fixed)

| Language | Issues Found | Key Problems |
|----------|-------------|--------------|
| German (de) | 14 | du/Sie pronoun mixing in 10+ strings (all fixed to informal "du"); "ein sicheres Schlüssel" grammar error |
| Dutch (nl) | 9 | "Back Up Je Account Key" untranslated; "account sleutel" split (should be "accountsleutel"); "Sleep en sleep" drag-drop mistranslation |
| Swedish (sv) | 11 | Systematic "ditt kontonyckel" gender error (nyckel is en-word); "enhetars" → "enhetens" |
| Thai (th) | 9 | "key" omitted in 4 strings ("Back Up Your Account Key" → "Back Up Your Account"); passkey → "password request" in 1 string |
| Romanian (ro) | 8 | 1 completely untranslated string; "passkey" = two different terms ("cheie de acces" vs "cheie de trecere") |
| Traditional Chinese (zh-TW) | 8 | Simplified characters used throughout (設置/設定, 文件/檔案, 加載/載入, etc.); passkey dropped to generic "密鑰" in 4 strings |

### Medium Severity Issues (fixed)

| Language | Issues Found | Key Problems |
|----------|-------------|--------------|
| Spanish (es) | 6 | "passkey" vs "clave de acceso" mixed; "own your identity" → "control your identity"; "Ajustes" → "Configuración" |
| French (fr) | 6 | Escaped quotes `\"` in backup string (would render as literal backslash-quote); passkey unified to loanword |
| Portuguese (pt) | 7 | EP "reintroduza" in BP file; "passkey" vs "chave de acesso" mixed; explicit "Eu" pronoun in buttons |
| Russian (ru) | 5 | "пассключ" vs "парольный ключ" passkey inconsistency; "Всё сделали!" wrong for "You're all set!" |
| Arabic (ar) | 3 | 3 different Arabic terms for passkey; "path/road" instead of "way/manner" |
| Turkish (tr) | 7 | Typo "sadeca"; case error "bunu kimse" → "buna kim"; "Face ID" incorrectly translated |
| Czech (cs) | 6 | "Vaše účtový klíč" gender error (klíč is masculine); T/V inconsistency; "instead" dropped |
| Slovak (sk) | 8 | "Vaša účtový kľúč" gender error; "Pretepte" not a real word; Czech "vestavene" used |
| Korean (ko) | 5 | "Help others recognize you" → subject flipped; "instead" dropped; "account is secured" unnatural |
| Japanese (ja) | 7 | "Enter Quorum" → "入力" (input data); "Skip for now" → "後でスキップ" (skip later); セキュア/安全 inconsistency |
| Vietnamese (vi) | 5 | "Enter Quorum" → "Nhập" (import/enter data); "master password" → "exact password" |
| Simplified Chinese (zh-CN) | 5 | "通行証" (travel permit) for passkey; "Skip for now" → "skip later"; word order |
| Indonesian (id) | 5 | "kunci sandi" vs "kunci akses" vs "passkey" inconsistency; "Enter Quorum" = "Sign in" (identical) |
| Italian (it) | 7 | Gendered "Benvenuto" (not "Benvenuto/a"); "chiave account" vs "chiave dell'account" inconsistent |
| Danish (da) | 8 | "kontokey" mixed compound; "nøglenopsætning" for passkey setup; English "timed out" left in |
| Polish (pl) | 6 | Missing diacritic "Jestes" → "Jesteś"; gender error "żaden platforma" → "żadna platforma" |
| Pirate English (en-PI) | 25+ | Hostile insults on help/FAQ strings ("ye bilge rat", "ye scallywag" etc.); Spanish strings contaminating the file; inconsistent pirate coverage |

---

## What Was Fixed vs. Not Fixed

### Fixed (this session)

- All 53 × 30 = 1,590 newly translated onboarding strings
- Some pre-existing strings were also improved as a side effect:
  - Passkey terminology unified across entire files (not just onboarding), since inconsistency affects all screens
  - German du/Sie fixes applied to all strings (register consistency is app-wide)
  - Pirate English hostile tone removed from non-onboarding strings (e.g. settings, notifications)
  - Japanese pre-existing "Yesterday at {time}" grammar fix
  - Spanish strings leaked into en-PI file removed

### Not Fixed (future work)

The ~824 remaining translated strings per language (existing non-onboarding UI) were NOT reviewed. Based on the patterns found in onboarding strings, the same classes of issues likely exist elsewhere:

1. **Passkey terminology** — though we unified within each file, any strings added before this session may still use old inconsistent terms
2. **Register mixing** (German du/Sie, French tu/vous, Czech T/V) — only onboarding strings were targeted
3. **Gender agreement** errors (Swedish, Czech, Slovak) — may recur in existing strings
4. **Translation quality** — some languages (Greek, Norwegian, Finnish) showed severe LLM errors in onboarding; the same model generated all their existing translations and likely has similar issues

---

## Recommendations for Future Quality Pass

### High Priority

1. **Systematic review of all strings for the 7 critical-error languages**
   - **Languages**: Greek, Hebrew, Norwegian, Finnish, Slovenian (Serbian contamination risk), Ukrainian
   - **Why**: If the LLM produced "packaging machine" for "device" in onboarding strings, it likely did the same elsewhere
   - **How**: Run review agents on ALL untranslated-then-LLM-translated strings, not just the 53 new ones
   - **Approach**: Group by language, run the same 4-agent parallel review pattern used this session

2. **Passkey terminology audit across all existing strings**
   - **Languages**: All 30
   - **Why**: Pre-existing strings may still use old terms (passordnøkkel, geçiş anahtarı, etc.) for passkey
   - **How**: `grep -n "passkey\|Passkey\|kunci sandi\|geçiş anahtarı\|passordnøkkel\|salakulku" src/i18n/*/messages.po`

3. **Register consistency audit**
   - **Languages**: de (du/Sie), fr (tu/vous), cs/sk (T/V), ko (honorifics)
   - **Why**: We only fixed onboarding; existing UI strings may still mix registers
   - **How**: Grep for formal pronouns in files that should use informal register

### Medium Priority

4. **zh-TW Simplified character audit**
   - Check all existing zh-TW strings for Simplified forms (設置, 文件, 加載, 訪問, 添加, 信息)
   - Replace with Traditional equivalents throughout

5. **Arabic gender agreement review**
   - The 3-passkey-term issue suggests other gender/agreement errors may exist

6. **Pirate English (en-PI) coverage audit**
   - Many non-onboarding strings remain in plain English without pirate flavoring
   - Hostile insults may have been added to other strings not caught in this session

---

## Full Quality Pass Complete — 2026-04-20

All 30 languages reviewed and fixed in parallel subagent batches:

| Phase | Languages | Commits |
|-------|-----------|---------|
| Phase 1 — Critical | el, he, no, fi, sl, sr, uk | 5f0a3c6, af22087, 53e6cd7, 527dacb, 97da0f8, 3f834bfe, 3643386f, 8f337c00, 1dd7b5c5 |
| Phase 2 — High severity | de, nl, sv, th, ro, zh-TW | 1481bba8, fed07658, 1a826fa1, 7319c2b1, 54d8318d, 7a616f48 |
| Phase 3A — Medium | es, fr, pt, ru | b59a38c0, 85943d9f, 64c8570a, b755f00e |
| Phase 3B — Medium | ar, tr, cs, sk | 8f5cbd3d, da14bc90, 26cafd8f, 470d668e |
| Phase 3C — Medium | ko, ja, vi, zh-CN | 2659622d, 07a7f63b, b210ca2e, ced0e3e5 |
| Phase 3D + Special | id, it, da, pl, en-PI | 8d14b289, afafc3a7, 6a59ac49, b2ea6f18, c52b2686 |
| Phase 4 — Compile | all | da14416c |

### Highlights of Additional Issues Found Beyond Original Audit Predictions

- **Finnish**: 55 additional fixes beyond known patterns — "Bold" translated as "brave/courageous", "Tap" translated as "knock/rap", 2× invented word "Animoidit", theme "Light" → correct adjective form
- **Dutch**: "account sleutel" compound error extended beyond onboarding; "HTML tariffs" for HTML tags; full Space terminology overhaul
- **Romanian**: "Espaciul/Espaciului" — entirely invented non-Romanian word used in 10 strings; verb form errors (infinitive used as imperative); formality unification across ~25 strings
- **Thai**: "Space" had been translated as "พื้นที่" (physical area) throughout — 30+ instances corrected to keep "Space" in English
- **Serbian**: Cyrillic "Простор" → Latin "Prostor" for Space; full informal register pass; Croatian words replaced
- **Ukrainian**: 14 instances of wrong "Простір" declension fixed
- **Traditional Chinese**: 80+ Simplified character replacements across the full file, not just the ~6 originally predicted
- **German**: 135 strings fixed — far more than predicted; "Space" had been translated as "Raum" and "Platz" throughout
- **Vietnamese**: "Space" had been translated as "Không gian" (physical space) in 58 strings — all corrected to English "Space"
- **Polish**: "Space" translated as "Przestrzeń" with full declension (nominative/genitive) added throughout

### Remaining Known Limitations

1. **Pirate English (en-PI)**: Coverage is still incomplete — many UI strings got minimal pirate treatment. The file is functional and non-hostile, but a dedicated pirate-flavor pass would improve personality.
2. **Arabic gender**: The passkey unification was done, but a full grammatical audit by a human native speaker is recommended.
3. **Context-sensitive strings**: Some strings without clear context (single words like "More", "Back") may be translated incorrectly for their UI context — a visual/in-app review would catch these.
4. **Plural forms**: Languages with complex plural rules (Polish, Czech, Slovak, Arabic, Russian) use Lingui's plural syntax — this was not systematically verified.

## State at End of This Session (2026-04-20)

```
Date: 2026-04-20
Branch: fix/improve-translations
Strings per language: ~877 total / 0 untranslated
Languages reviewed: 30
Files modified: all src/i18n/{locale}/messages.po and messages.ts
Compile status: Compiled successfully (commit da14416c)
```

---

## Appendix: Issues by Category (all languages)

### Wrong word / semantic error
- el: "συσκευαστής" (packaging machine) for device
- el: "παράκτημα" (outbuilding) for password
- el: "προσβάλει" (assault) for access
- he: "מקלחת" (shower) for key (in 2 strings)
- he: "מפתח העברה" (transfer key) for passkey
- no: "fingervipps" for fingerprint
- no: "passordnøkkel" (password key) for passkey
- no: "sikkerhetsskyttel" (not a real word) for hardware protection
- fi: "salakulkutunniste" (smuggling identifier) for passkey
- fi: "avainteesi" (not a real word) for your key
- sl: "geslo" (password) for passkey (throughout)
- sl: "odprta" (open) for decentralized
- sr: "Napredak" (progress) for back up
- uk: "відредагували" (edited) for "all set"
- zh-CN: "通行证" (travel permit) for passkey
- vi: "Nhập" (input/import) for enter
- vi: "chính xác" (exact) for master
- ja: "入力" (input data) for enter
- ko: subject flipped on recognition string
- tr: "Yüz Tanıma" (facial recognition) for Face ID (brand name)
- ar: "الطريق" (road/path) for "the way/manner"

### Wrong language
- sl: 2 full strings in Serbian/Croatian
- en-PI: ~6 strings in Spanish

### Untranslated
- el: RegistrationPersister string
- ro: RegistrationPersister string
- uk: RegistrationPersister string

### Terminology inconsistency (passkey)
- es: "clave de acceso" vs "passkey" (mixed)
- fr: "clé d'accès" (unified to "passkey" in this session)
- pt: "chave de acesso" vs "passkey" (mixed)
- ro: "cheie de acces" vs "cheie de trecere" (two different terms)
- ru: "пассключ" vs "парольный ключ" (mixed)
- ar: 3 terms: "مفتاح رقمي", "مفتاح شخصي", "مفتاح المرور"
- tr: "geçiş anahtarı" vs "passkey" (mixed)
- id: "kunci sandi" vs "kunci akses" vs "passkey" (3 terms)
- da: "nøglenopsætning" and "adgangskodeanmodning" for passkey terms
- no: "passordnøkkel" throughout (all fixed)
- fi: "salakulkutunniste" vs "passkey" (all fixed)
- uk: "паспорт ключа" vs "пароль-ключ" (all fixed)

### Register/pronoun inconsistency
- de: "Sie/Ihr" mixed with "du/dein" (~14 strings)
- cs: "ty" form in "tvým" mixed with "vy" form
- sk: "autorizuj" (ty) mixed with "vás/váš" (vy)
- nl: "Gelieve" (formal Belgian) mixed with "je" (informal Netherlands)
- sr: "Molimo" (formal) + "autorizuj" (informal)

### Grammar/gender errors
- el: "ένα φωτογραφία" → "μία φωτογραφία"; "Το λογαριασμό" → "Ο λογαριασμός"
- sv: "ditt kontonyckel" (8 instances — nyckel is en-word)
- sv: "enhetars" → "enhetens"
- sv: "Kontadress" → "Kontoadress" (typo)
- cs: "Vaše účtový klíč" (klíč is masculine)
- sk: "Vaša účtový kľúč" (kľúč is masculine)
- he: "שתי אישורים מהירות" → "שני אישורים מהירים"
- uk: "одна підтвердження" → "одне підтвердження"; "двох підтвердження" → "двох підтверджень"
- uk: "Без цього резервної копії" → "Без цієї резервної копії"
- no: "to rask bekreftelser" → "to raske bekreftelser"
- pl: "żaden platforma" → "żadna platforma"
- sr: "vaša jedinstvena identitet" → "vaš jedinstveni identitet"
- sr: "naloge" → "naloga" (7 instances)
- it: "Benvenuto" (masculine only) for welcome
- it: "chiave account" vs "chiave dell'account" inconsistency
- it: "Nessun'email" → "Nessuna email"
- nl: "Passkey instellingen zijn mislukt" → "is mislukt" (singular)

### Typos / missing diacritics
- no: "deentralisert" → "desentralisert"
- pl: "Jestes" → "Jesteś"
- sk: "Vaš" → "Váš"
- tr: "sadeca" → "sadece"
- sr: "odtis" → "otisak"
- sk: "vestavene" (Czech) → "zabudované" (Slovak)
- sv: "Kontadress" → "Kontoadress"

### Naturalness/phrasing
- ru: "Вы все сделали!" → "Всё готово!" (You're all set)
- ru: "Пропустить на данный момент" → "Пропустить пока"
- ko: "계정이 보안되어" unnatural
- ko: RegistrationPersister temporal clause garbled
- ja: "後でスキップ" (skip later) → "今はスキップ" (skip now)
- zh-CN: "稍后跳过" (skip later) → "暂时跳过" (skip for now)
- zh-CN: conditional word order wrong
- pt: "Eu entendi" / "Eu já tenho uma conta" (drop explicit "Eu")
- pt: "reintroduza" (EP) → "insira novamente" (BP)
- fr: `\"mot de passe oublié\"` → «\u00a0mot de passe oublié\u00a0»
- nl: "Sleep en sleep" → "Sleep en zet neer" (drag and drop)
- nl: "account sleutel" (9 instances) → "accountsleutel"
- da: "kontokey" → "kontonøgle" (10 instances)
- da: "timed out" left in English
- th: "key" omitted in 4 strings
- fi: "Tuodaan tilin avainta" (let us import) → "Tuo tilin avain" (imperative)
- en-PI: hostile insults on 20+ strings including help, FAQ, buttons

---

*Created: 2026-04-14*
*Updated: 2026-04-20 — Full quality pass complete*
*Report Type: Audit*
