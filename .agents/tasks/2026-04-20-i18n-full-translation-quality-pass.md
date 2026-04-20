# i18n Full Translation Quality Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review and fix all ~750 translated strings across 30 languages using Claude subagents, then translate all remaining untranslated strings, resulting in a fully reviewed, high-quality translation set.

**Architecture:** Parallel subagent batches (4–6 languages at a time), each agent reads one PO file, applies targeted fixes using Edit tool based on known error patterns, then summarises changes. Orchestrator updates the audit report after each batch. Final pass translates remaining blank strings.

**Tech Stack:** Lingui PO files (`src/i18n/{locale}/messages.po`), Claude subagents (Sonnet), Edit/Read tools, audit report at `.agents/reports/2026-04-14-i18n-onboarding-translation-audit.md`

**Reference audit report:** `.agents/reports/2026-04-14-i18n-onboarding-translation-audit.md`

---

## Critical Context for All Subagents

Every subagent working on a PO file MUST know the following before starting.

### PO File Format — What "empty" means

In Lingui PO files, `msgstr ""` on a single line does NOT always mean untranslated. Strings that span multiple lines look like:

```
msgid "Some long string"
msgstr ""
"First line of translation"
" continued here"
```

The `msgstr ""` is the opening delimiter, and the actual content follows on subsequent quoted lines. **Only treat a string as untranslated if `msgstr ""` is the ONLY line (nothing follows it on the next line before a blank line or `#`).**

### Translation Rules (from `src/i18n/translation-prompt.txt`)

These rules MUST be respected in all edits:

**Never translate these words (keep in English):**
- Quorum, Quilibrium, Emoji, Emojis, useWebSocket, WebSocketProvider

**Never translate content inside:**
- Curly braces `{username}`, `{count}`, etc.
- Angle brackets `<0>Click here</0>` (Lingui JSX tags)

**"Space" (app feature like Discord servers):**
- KEEP in English for: da, de, fi, id, nl, no, sv, th, vi
- TRANSLATE for all other languages: fr=Espace, es=Espacio, it=Spazio, pt=Espaço, ru=Пространство, pl=Przestrzeń, cs=Prostor, sk=Priestor, uk=Простір, ja=スペース, ko=공간, zh-CN=空间, zh-TW=空間, ar=الفضاء, tr=Alan, he=מרחב, el=Χώρος, ro=Spațiu, sl=Prostor, sr=Prostor

**"Channel":**
- French only: always "canal" (never "chaîne" which means TV channel)

**"Mute/Unmute":**
- Serbian: "isključi" / "ponovo uključi"
- Portuguese: "Silenciar" / "Reativar som"

**"Bookmark":**
- Portuguese: always "Marcador/Marcadores" (never "Favorito")

**"Sticker":**
- Swedish: "Klistermärken" (never "Klippor")

**Pirate English (en-PI):**
- Translate into pirate English — nautical slang, playful, NOT hostile
- Never use real insults directed at the user

---

## Execution Model

Each language task dispatches a **Sonnet subagent** with:
1. The English source file (`src/i18n/en/messages.po`) for reference
2. The target language PO file
3. A precise brief listing known error patterns for that language (from the audit report)
4. The full "Critical Context" section above (translation rules + PO format note)
5. Instructions to fix ALL issues found — known patterns AND anything else that looks wrong
6. Instructions to return a bullet-point summary of every string changed

**When writing subagent prompts:** Always paste the "Critical Context" section at the top of every brief, before language-specific instructions.

The orchestrator (this session) reviews each batch summary before moving to the next phase.

---

## Phase 1 — Critical Languages (severe semantic errors)

**Languages:** Greek (el), Hebrew (he), Norwegian (no), Finnish (fi), Slovenian (sl), Serbian (sr), Ukrainian (uk)

These had catastrophic LLM errors: wrong words ("packaging machine" for device), wrong-language contamination, invented words. Every string needs full semantic review against English source.

---

### Task 1: Greek (el) — Full review

**Files:**
- Review + fix: `src/i18n/el/messages.po`
- Reference: `src/i18n/en/messages.po`

**Known issues from audit (onboarding already fixed — check for same patterns in remaining strings):**
- "device" → "συσκευαστής" (packaging machine) — look for συσκευαστής anywhere
- "password" → "παράκτημα" (outbuilding)
- "access" → "προσβάλει" (assault)
- Gender errors: "ένα φωτογραφία" (should be μία), article/noun gender mismatches
- Formal register: file should use informal register throughout
- 128 untranslated strings — translate them all

**Subagent brief:**
```
You are a native Greek translator reviewing a software app translation file.
Read src/i18n/en/messages.po (English source) and src/i18n/el/messages.po (Greek).
For each Greek string:
1. Check for semantic errors — wrong word choices, invented words, wrong register
2. Check gender agreement (articles must match noun gender)
3. Check that the app uses informal register (εσύ/σου forms, not εσείς/σας for the user)
4. Translate all empty msgstr "" entries
5. Fix every issue you find

Known error patterns to specifically hunt for:
- συσκευαστής (packaging machine) used for device/συσκευή
- παράκτημα (outbuilding) used for password/κωδικός
- προσβάλει (assault) used for access/πρόσβαση
- Article-noun gender mismatches (ένα/μία, ο/η/το errors)

Edit the file directly. Return a bullet list of every string you changed and why.
```

- [ ] **Step 1.1:** Dispatch Sonnet subagent for Greek with brief above
- [ ] **Step 1.2:** Review the change summary returned by the subagent
- [ ] **Step 1.3:** Spot-check 5–10 random fixed strings in `src/i18n/el/messages.po` against English source
- [ ] **Step 1.4:** Commit

```bash
git add src/i18n/el/messages.po
git commit -m "fix(i18n): Greek full quality review and untranslated strings"
```

---

### Task 2: Hebrew (he) — Full review

**Files:**
- Review + fix: `src/i18n/he/messages.po`
- Reference: `src/i18n/en/messages.po`

**Known issues:**
- "key" → "מקלחת" (shower) — search for מקלחת
- "מפתח העברה" (transfer key) for passkey — should be "מפתח גישה" or loanword "פאסקי"
- Garbled passkey timeout strings
- "שתי אישורים מהירות" → "שני אישורים מהירים" (gender/agreement)
- 69 untranslated strings

**Subagent brief:**
```
You are a native Hebrew translator reviewing a software app translation file.
Read src/i18n/en/messages.po (English source) and src/i18n/he/messages.po (Hebrew).
For each Hebrew string:
1. Check for semantic errors — wrong word choices, nonsensical phrases
2. Check gender agreement (masculine/feminine)
3. Verify passkey is translated consistently — use "מפתח גישה" or loanword "פאסקי" throughout
4. Translate all empty msgstr "" entries
5. Fix every issue you find

Known error patterns:
- מקלחת (shower) used for key/מפתח — replace with correct term
- Transfer-key mis-translation for passkey
- Gender errors in number phrases (שתי/שני, feminine/masculine adjective agreement)
- RTL punctuation and quote handling

Edit the file directly. Return a bullet list of every string you changed and why.
```

- [ ] **Step 2.1:** Dispatch Sonnet subagent for Hebrew
- [ ] **Step 2.2:** Review change summary
- [ ] **Step 2.3:** Spot-check 5–10 strings
- [ ] **Step 2.4:** Commit

```bash
git add src/i18n/he/messages.po
git commit -m "fix(i18n): Hebrew full quality review and untranslated strings"
```

---

### Task 3: Norwegian (no) — Full review

**Files:**
- Review + fix: `src/i18n/no/messages.po`
- Reference: `src/i18n/en/messages.po`

**Known issues:**
- "fingerprint" → "fingervipps" (a payment app name!) — search for fingervipps
- "passkey" → "passordnøkkel" (password key) throughout — use "tilgangsnøkkel" or loanword "passkey"
- "deentralisert" typo — search and fix
- "to rask bekreftelser" → "to raske bekreftelser"
- "sikkerhetsskyttel" invented word
- 98 untranslated strings

**Subagent brief:**
```
You are a native Norwegian (Bokmål) translator reviewing a software app translation file.
Read src/i18n/en/messages.po (English source) and src/i18n/no/messages.po (Norwegian).
For each Norwegian string:
1. Check for invented words, wrong words, brand-name contamination
2. Verify passkey terminology is consistent — use "passkey" (loanword) or "tilgangsnøkkel" throughout
3. Fix grammar errors and adjective agreement
4. Translate all empty msgstr "" entries
5. Fix every issue you find

Known error patterns:
- "fingervipps" (Vipps payment app name) used for fingerprint/fingeravtrykk
- "passordnøkkel" (password key) used for passkey — should be "passkey" or "tilgangsnøkkel"
- "sikkerhetsskyttel" — invented word, check context and use correct term
- "deentralisert" typo → "desentralisert"
- Adjective agreement errors (raske not rask with plural nouns)

Edit the file directly. Return a bullet list of every string you changed and why.
```

- [ ] **Step 3.1:** Dispatch Sonnet subagent for Norwegian
- [ ] **Step 3.2:** Review change summary
- [ ] **Step 3.3:** Spot-check 5–10 strings
- [ ] **Step 3.4:** Commit

```bash
git add src/i18n/no/messages.po
git commit -m "fix(i18n): Norwegian full quality review and untranslated strings"
```

---

### Task 4: Finnish (fi) — Full review

**Files:**
- Review + fix: `src/i18n/fi/messages.po`
- Reference: `src/i18n/en/messages.po`

**Known issues:**
- "passkey" → "salakulkutunniste" (smuggling identifier!) — search and replace throughout
- "avainteesi" — invented word for "your key"
- Wrong verb mood in several strings
- "Tuodaan tilin avainta" (let us import) → imperative "Tuo tilin avain"
- 94 untranslated strings

**Subagent brief:**
```
You are a native Finnish translator reviewing a software app translation file.
Read src/i18n/en/messages.po (English source) and src/i18n/fi/messages.po (Finnish).
For each Finnish string:
1. Check for invented words, wrong semantic choices, wrong verb forms
2. Verify passkey is "passkey" (loanword) or "pääsyavain" throughout — never "salakulkutunniste"
3. Check verb moods (UI strings like buttons should use imperative)
4. Translate all empty msgstr "" entries
5. Fix every issue you find

Known error patterns:
- "salakulkutunniste" (smuggling identifier) used for passkey — replace with "passkey" or "pääsyavain"
- "avainteesi" — invented word, check context
- Wrong verb mood: "Tuodaan" (let's import) should be "Tuo" (import) for imperative buttons
- Invented compound words — verify against standard Finnish

Edit the file directly. Return a bullet list of every string you changed and why.
```

- [ ] **Step 4.1:** Dispatch Sonnet subagent for Finnish
- [ ] **Step 4.2:** Review change summary
- [ ] **Step 4.3:** Spot-check 5–10 strings
- [ ] **Step 4.4:** Commit

```bash
git add src/i18n/fi/messages.po
git commit -m "fix(i18n): Finnish full quality review and untranslated strings"
```

---

### Task 5: Slovenian (sl) — Full review

**Files:**
- Review + fix: `src/i18n/sl/messages.po`
- Reference: `src/i18n/en/messages.po`

**Known issues:**
- Serbian/Croatian strings contaminating the file (wrong language entirely)
- "passkey" → "geslo" (password) — should be "geslo za dostop" or loanword "passkey"
- "decentralized" → "odprta" (open) — wrong meaning
- 95 untranslated strings

**Subagent brief:**
```
You are a native Slovenian translator reviewing a software app translation file.
Read src/i18n/en/messages.po (English source) and src/i18n/sl/messages.po (Slovenian).
For each Slovenian string:
1. Verify the string is actually in Slovenian (not Serbian, Croatian, or Bosnian)
2. Check for semantic errors — wrong word choices
3. Verify passkey terminology is consistent — use "geslo za dostop" or loanword "passkey"
4. Translate all empty msgstr "" entries
5. Fix every issue you find

Known error patterns:
- Full strings in Serbian/Croatian (e.g. using "lozinka" instead of Slovenian "geslo" base)
- "geslo" (password) used for passkey — should include "za dostop" or use loanword
- "odprta" (open) used for decentralized/decentraliziran

Edit the file directly. Return a bullet list of every string you changed and why.
```

- [ ] **Step 5.1:** Dispatch Sonnet subagent for Slovenian
- [ ] **Step 5.2:** Review change summary
- [ ] **Step 5.3:** Spot-check 5–10 strings
- [ ] **Step 5.4:** Commit

```bash
git add src/i18n/sl/messages.po
git commit -m "fix(i18n): Slovenian full quality review and untranslated strings"
```

---

### Task 6: Serbian (sr) — Full review

**Files:**
- Review + fix: `src/i18n/sr/messages.po`
- Reference: `src/i18n/en/messages.po`

**Known issues:**
- "Back Up" → "Napredak" (Progress) — wrong word
- Systematic wrong genitive: "naloge" → "naloga" (7+ instances)
- "cancelled" → "unhooked" (wrong)
- Register mixing: "Molimo" (formal) + "autorizuj" (informal) in same file
- "vaša jedinstvena identitet" → "vaš jedinstveni identitet" (gender)
- 95 untranslated strings

**Subagent brief:**
```
You are a native Serbian translator reviewing a software app translation file.
Read src/i18n/en/messages.po (English source) and src/i18n/sr/messages.po (Serbian, Cyrillic or Latin).
For each Serbian string:
1. Check for semantic errors — wrong word choices
2. Verify consistent register — use informal register (ti/tvoj) throughout
3. Fix genitive case errors — "naloga" not "naloge" for account genitive
4. Fix gender agreement errors
5. Translate all empty msgstr "" entries

Known error patterns:
- "Napredak" (progress/advancement) used for back up — fix to backup term
- "naloge" → "naloga" (incorrect genitive of nalog, check all instances)
- Formal "Molimo" mixed with informal "autorizuj" — standardize to informal
- "vaša jedinstvena identitet" — identitet is masculine, fix to "vaš jedinstveni identitet"

Edit the file directly. Return a bullet list of every string you changed and why.
```

- [ ] **Step 6.1:** Dispatch Sonnet subagent for Serbian
- [ ] **Step 6.2:** Review change summary
- [ ] **Step 6.3:** Spot-check 5–10 strings
- [ ] **Step 6.4:** Commit

```bash
git add src/i18n/sr/messages.po
git commit -m "fix(i18n): Serbian full quality review and untranslated strings"
```

---

### Task 7: Ukrainian (uk) — Full review

**Files:**
- Review + fix: `src/i18n/uk/messages.po`
- Reference: `src/i18n/en/messages.po`

**Known issues:**
- "You're all set!" → "You've edited everything!" (відредагували)
- "What should we call you?" → "What should we call ourselves?"
- "одна підтвердження" → "одне підтвердження" (neuter gender)
- "Без цього резервної копії" → "Без цієї резервної копії"
- 114 untranslated strings

**Subagent brief:**
```
You are a native Ukrainian translator reviewing a software app translation file.
Read src/i18n/en/messages.po (English source) and src/i18n/uk/messages.po (Ukrainian).
For each Ukrainian string:
1. Check for semantic errors — mistranslations that change meaning entirely
2. Check gender agreement and case agreement
3. Verify personal pronoun usage — "you" addressing the user should use ти (informal) consistently
4. Translate all empty msgstr "" entries
5. Fix every issue you find

Known error patterns:
- "відредагували все" (you edited everything) for "You're all set!" — fix to "Все готово!" or similar
- Wrong pronoun perspective — "нас" (ourselves) instead of "вас" (you)
- "одна підтвердження" — підтвердження is neuter, so "одне підтвердження"
- "цього резервної копії" — резервна копія is feminine, so "цієї резервної копії"

Edit the file directly. Return a bullet list of every string you changed and why.
```

- [ ] **Step 7.1:** Dispatch Sonnet subagent for Ukrainian
- [ ] **Step 7.2:** Review change summary
- [ ] **Step 7.3:** Spot-check 5–10 strings
- [ ] **Step 7.4:** Commit

```bash
git add src/i18n/uk/messages.po
git commit -m "fix(i18n): Ukrainian full quality review and untranslated strings"
```

---

### Task 8: Phase 1 complete — Update audit report

- [ ] **Step 8.1:** Update `.agents/reports/2026-04-14-i18n-onboarding-translation-audit.md`
  - Add a new section "## Phase 1 Quality Pass — [date]" with summary of all 7 languages reviewed
  - Note any issues found beyond what the original audit predicted
  - Update the "Not Fixed (future work)" section to cross off completed items
- [ ] **Step 8.2:** Commit report update

```bash
git add .agents/reports/2026-04-14-i18n-onboarding-translation-audit.md
git commit -m "docs: update i18n audit report after Phase 1 quality pass"
```

---

## Phase 2 — High-Severity Languages (targeted review)

**Languages:** German (de), Dutch (nl), Swedish (sv), Thai (th), Romanian (ro), Traditional Chinese (zh-TW)

These have known specific issues. Agents should hunt for those patterns first, then do a general quality pass.

---

### Task 9: German (de) — Register + grammar

**Files:** `src/i18n/de/messages.po`, reference `src/i18n/en/messages.po`

**Known issues:**
- du/Sie pronoun mixing — onboarding fixed; remaining UI strings may still use "Sie/Ihr"
- Grammar errors (e.g. "ein sicheres Schlüssel" — Schlüssel is masculine, should be "ein sicherer Schlüssel")
- 121 untranslated strings

**Subagent brief:**
```
You are a native German translator reviewing a software app translation file.
Read src/i18n/en/messages.po and src/i18n/de/messages.po.
The app uses INFORMAL register throughout (du/dein/dir), never formal (Sie/Ihr/Ihnen).

Tasks:
1. Find every instance of "Sie", "Ihr", "Ihnen" used as formal pronouns — replace with informal equivalents
2. Check noun gender agreement (article + adjective + noun must all agree)
3. Check compound noun spelling (German compounds are written as one word)
4. Translate all empty msgstr "" entries
5. Fix any other quality issues found

Known patterns:
- Formal "Sie" forms anywhere in the file — change to "du" forms
- "ein sicheres Schlüssel" → "ein sicherer Schlüssel" (Schlüssel is masculine)
- Compound nouns written as two words (e.g. "Konto Schlüssel" → "Kontoschlüssel")

Edit the file directly. Return a bullet list of every string changed and why.
```

- [ ] **Step 9.1:** Dispatch Sonnet subagent for German
- [ ] **Step 9.2:** Review change summary
- [ ] **Step 9.3:** Spot-check 5–10 strings, especially du/Sie switches
- [ ] **Step 9.4:** Commit

```bash
git add src/i18n/de/messages.po
git commit -m "fix(i18n): German register consistency and grammar review"
```

---

### Task 10: Dutch (nl) — Compounds + register + mistranslations

**Files:** `src/i18n/nl/messages.po`, reference `src/i18n/en/messages.po`

**Known issues:**
- "account sleutel" (9 instances) → "accountsleutel" (Dutch compounds are one word)
- "Sleep en sleep" for drag-and-drop → "Sleep en zet neer"
- "Gelieve" (formal Belgian) mixed with "je" (informal Netherlands) — standardise to informal je
- "Passkey instellingen zijn mislukt" → "is mislukt" (singular subject)
- 112 untranslated strings

**Subagent brief:**
```
You are a native Dutch translator reviewing a software app translation file.
Read src/i18n/en/messages.po and src/i18n/nl/messages.po.
The app uses informal register (je/jouw) throughout — not formal Belgian (u/uw/Gelieve).

Tasks:
1. Find all compound nouns written as two words — join them (Dutch writes compounds as one word)
2. Replace formal Belgian forms ("Gelieve", "u", "uw") with informal Netherlands Dutch ("je", "jouw")
3. Fix mistranslations
4. Translate all empty msgstr "" entries
5. Fix any other quality issues

Known patterns:
- "account sleutel" → "accountsleutel" (find all two-word compounds)
- "Sleep en sleep" for drag and drop → "Sleep en zet neer"
- "Gelieve" anywhere → replace with appropriate informal phrasing
- Subject-verb agreement: singular subjects take "is mislukt", not "zijn mislukt"

Edit the file directly. Return a bullet list of every string changed and why.
```

- [ ] **Step 10.1:** Dispatch Sonnet subagent for Dutch
- [ ] **Step 10.2:** Review change summary
- [ ] **Step 10.3:** Spot-check strings
- [ ] **Step 10.4:** Commit

```bash
git add src/i18n/nl/messages.po
git commit -m "fix(i18n): Dutch compound nouns, register, and mistranslations"
```

---

### Task 11: Swedish (sv) — Gender agreement + typos

**Files:** `src/i18n/sv/messages.po`, reference `src/i18n/en/messages.po`

**Known issues:**
- "ditt kontonyckel" systematic error — "nyckel" is en-word (common gender), so "din kontonyckel" (8+ instances)
- "enhetars" → "enhetens" (genitive)
- "Kontadress" typo → "Kontoadress"
- 105 untranslated strings

**Subagent brief:**
```
You are a native Swedish translator reviewing a software app translation file.
Read src/i18n/en/messages.po and src/i18n/sv/messages.po.

Tasks:
1. Find all gender agreement errors — "nyckel" is an en-word (utrum), so it takes "din/en" not "ditt/ett"
2. Fix genitive forms
3. Fix typos
4. Translate all empty msgstr "" entries
5. General quality review

Known patterns:
- "ditt kontonyckel" → "din kontonyckel" (nyckel is en-word, not ett-word) — find all instances
- "enhetars" → "enhetens" (genitive of enhet)
- "Kontadress" typo → "Kontoadress"
- Check other en/ett gender agreements throughout

Edit the file directly. Return a bullet list of every string changed and why.
```

- [ ] **Step 11.1:** Dispatch Sonnet subagent for Swedish
- [ ] **Step 11.2:** Review change summary
- [ ] **Step 11.3:** Spot-check strings
- [ ] **Step 11.4:** Commit

```bash
git add src/i18n/sv/messages.po
git commit -m "fix(i18n): Swedish gender agreement and typo fixes"
```

---

### Task 12: Thai (th) — Missing words + terminology

**Files:** `src/i18n/th/messages.po`, reference `src/i18n/en/messages.po`

**Known issues:**
- "key" omitted in 4 strings (e.g. "Back Up Your Account" missing "Key")
- "passkey" → "password request" in 1 string
- 86 untranslated strings

**Subagent brief:**
```
You are a native Thai translator reviewing a software app translation file.
Read src/i18n/en/messages.po and src/i18n/th/messages.po.

Tasks:
1. Check that translations are complete — no English words or phrases dropped without translation
2. Verify passkey terminology is consistent throughout
3. Check for natural Thai phrasing (not overly literal)
4. Translate all empty msgstr "" entries
5. Fix any other quality issues

Known patterns:
- Some strings about "Account Key" are missing the "key/กุญแจ" part
- Passkey should be "พาสคีย์" (loanword) or "กุญแจผ่าน" consistently — not "คำขอรหัสผ่าน" (password request)

Edit the file directly. Return a bullet list of every string changed and why.
```

- [ ] **Step 12.1:** Dispatch Sonnet subagent for Thai
- [ ] **Step 12.2:** Review change summary
- [ ] **Step 12.3:** Spot-check strings
- [ ] **Step 12.4:** Commit

```bash
git add src/i18n/th/messages.po
git commit -m "fix(i18n): Thai missing words and passkey terminology"
```

---

### Task 13: Romanian (ro) — Untranslated + terminology

**Files:** `src/i18n/ro/messages.po`, reference `src/i18n/en/messages.po`

**Known issues:**
- "cheie de acces" vs "cheie de trecere" — two different terms for passkey, unify
- 123 untranslated strings

**Subagent brief:**
```
You are a native Romanian translator reviewing a software app translation file.
Read src/i18n/en/messages.po and src/i18n/ro/messages.po.

Tasks:
1. Unify passkey terminology — use "cheie de acces" throughout (not "cheie de trecere")
2. Check for natural Romanian phrasing
3. Check gender agreement and case
4. Translate all empty msgstr "" entries (123 strings)
5. Fix any other quality issues

Known patterns:
- "cheie de trecere" anywhere → replace with "cheie de acces"
- Check article agreement with nouns (definite/indefinite, masculine/feminine/neuter)

Edit the file directly. Return a bullet list of every string changed and why.
```

- [ ] **Step 13.1:** Dispatch Sonnet subagent for Romanian
- [ ] **Step 13.2:** Review change summary
- [ ] **Step 13.3:** Spot-check strings
- [ ] **Step 13.4:** Commit

```bash
git add src/i18n/ro/messages.po
git commit -m "fix(i18n): Romanian passkey unification and untranslated strings"
```

---

### Task 14: Traditional Chinese (zh-TW) — Simplified character audit

**Files:** `src/i18n/zh-TW/messages.po`, reference `src/i18n/en/messages.po`

**Known issues:**
- Simplified characters used throughout: 設置→設定, 文件→檔案, 加載→載入, 訪問→存取, 添加→新增, 信息→資訊
- "密鑰" (generic key) used for passkey in 4 strings — should be "通行密鑰" or "密碼金鑰"
- Only 6 untranslated strings

**Subagent brief:**
```
You are a native Traditional Chinese (Taiwan) translator reviewing a software app translation file.
Read src/i18n/en/messages.po and src/i18n/zh-TW/messages.po.

This file must use Traditional Chinese characters as used in Taiwan, NOT Simplified Chinese.

Tasks:
1. Find all Simplified Chinese characters and replace with Traditional equivalents:
   - 設置 → 設定
   - 文件 → 檔案  
   - 加載 → 載入
   - 訪問 → 存取
   - 添加 → 新增
   - 信息 → 資訊
   - 软件/軟件 → 軟體
   - 网络 → 網路
   - 账号/账户 → 帳號/帳戶
   (Search for any other Simplified forms you find)
2. Unify passkey as "通行密鑰" throughout
3. Translate the 6 empty msgstr "" entries
4. General quality review for Taiwan-standard phrasing

Edit the file directly. Return a bullet list of every string changed and why.
```

- [ ] **Step 14.1:** Dispatch Sonnet subagent for Traditional Chinese
- [ ] **Step 14.2:** Review change summary
- [ ] **Step 14.3:** Spot-check Simplified→Traditional replacements specifically
- [ ] **Step 14.4:** Commit

```bash
git add src/i18n/zh-TW/messages.po
git commit -m "fix(i18n): zh-TW Simplified character replacement and passkey terminology"
```

---

### Task 15: Phase 2 complete — Update audit report

- [ ] **Step 15.1:** Update audit report with Phase 2 summary
- [ ] **Step 15.2:** Commit

```bash
git add .agents/reports/2026-04-14-i18n-onboarding-translation-audit.md
git commit -m "docs: update i18n audit report after Phase 2 quality pass"
```

---

## Phase 3 — Medium-Severity Languages (targeted review + untranslated)

**Languages:** Spanish (es), French (fr), Portuguese (pt), Russian (ru), Arabic (ar), Turkish (tr), Czech (cs), Slovak (sk), Korean (ko), Japanese (ja), Vietnamese (vi), Simplified Chinese (zh-CN), Indonesian (id), Italian (it), Danish (da), Polish (pl), Pirate English (en-PI)

Run these in parallel batches of 4–5 languages. Each subagent gets the language-specific known issues plus a general quality review instruction.

---

### Task 16: Batch A — Spanish, French, Portuguese, Russian (parallel)

**Files:** `src/i18n/{es,fr,pt,ru}/messages.po`

Dispatch 4 parallel subagents simultaneously.

**Spanish (es) brief:**
```
Native Spanish translator reviewing src/i18n/es/messages.po against src/i18n/en/messages.po.
Known issues: "passkey" vs "clave de acceso" mixed — unify to "clave de acceso" throughout.
"Ajustes" vs "Configuración" — use "Configuración" for Settings consistently.
"controlar tu identidad" vs "ser dueño/a de tu identidad" — prefer "ser dueño/a".
Translate all 118 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**French (fr) brief:**
```
Native French translator reviewing src/i18n/fr/messages.po against src/i18n/en/messages.po.
Known issues: escaped quotes \" anywhere in strings — replace with proper French guillemets «\u00a0...\u00a0» or regular quotes.
"passkey" is unified as loanword "passkey" — verify this is consistent throughout.
Translate all 129 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Portuguese (pt) brief:**
```
Native Brazilian Portuguese translator reviewing src/i18n/pt/messages.po against src/i18n/en/messages.po.
This is Brazilian Portuguese (BP), NOT European Portuguese (EP).
Known issues: "reintroduza" (EP) → "insira novamente" (BP). Explicit "Eu" pronoun in buttons → drop it (unnatural in BP).
"passkey" vs "chave de acesso" mixed — unify to "chave de acesso" or loanword "passkey".
Translate all 109 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Russian (ru) brief:**
```
Native Russian translator reviewing src/i18n/ru/messages.po against src/i18n/en/messages.po.
Known issues: "пассключ" vs "парольный ключ" mixed for passkey — unify to "ключ доступа" throughout.
"Всё сделали!" for "You're all set!" — fix to "Всё готово!" 
"Пропустить на данный момент" → "Пропустить пока".
Translate all 121 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

- [ ] **Step 16.1:** Dispatch all 4 subagents in parallel
- [ ] **Step 16.2:** Review all 4 change summaries
- [ ] **Step 16.3:** Spot-check key strings in each language
- [ ] **Step 16.4:** Commit all 4 files

```bash
git add src/i18n/es/messages.po src/i18n/fr/messages.po src/i18n/pt/messages.po src/i18n/ru/messages.po
git commit -m "fix(i18n): Spanish, French, Portuguese, Russian quality review"
```

---

### Task 17: Batch B — Arabic, Turkish, Czech, Slovak (parallel)

**Arabic (ar) brief:**
```
Native Arabic translator reviewing src/i18n/ar/messages.po against src/i18n/en/messages.po.
Known issues: 3 different Arabic terms for passkey — unify to "مفتاح المرور" throughout.
"الطريق" (road/path) used for "the way/manner" — fix to "الطريقة".
RTL punctuation and quote marks must be correct.
Translate all 76 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Turkish (tr) brief:**
```
Native Turkish translator reviewing src/i18n/tr/messages.po against src/i18n/en/messages.po.
Known issues: typo "sadeca" → "sadece". Case error "bunu kimse" → "buna kim".
"Yüz Tanıma" (facial recognition) used for "Face ID" brand name — keep "Face ID" untranslated.
"geçiş anahtarı" vs "passkey" mixed — unify to "geçiş anahtarı" or loanword "passkey".
Translate all 100 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Czech (cs) brief:**
```
Native Czech translator reviewing src/i18n/cs/messages.po against src/i18n/en/messages.po.
Known issues: "Vaše účtový klíč" — klíč is masculine, fix to "Váš účetní klíč".
T/V inconsistency (ty vs vy forms) — use informal ty forms throughout.
"instead" dropped in some strings — check completeness.
Translate all 96 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Slovak (sk) brief:**
```
Native Slovak translator reviewing src/i18n/sk/messages.po against src/i18n/en/messages.po.
Known issues: "Vaša účtový kľúč" — kľúč is masculine, fix to "Váš účetný kľúč".
"Pretepte" is not a real word — check context and fix.
Czech word "vestavene" used — replace with Slovak "zabudované".
"Váš" written as "Vaš" (missing háček) — fix all instances.
Translate all 97 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

- [ ] **Step 17.1:** Dispatch all 4 subagents in parallel
- [ ] **Step 17.2:** Review all 4 change summaries
- [ ] **Step 17.3:** Spot-check key strings
- [ ] **Step 17.4:** Commit all 4 files

```bash
git add src/i18n/ar/messages.po src/i18n/tr/messages.po src/i18n/cs/messages.po src/i18n/sk/messages.po
git commit -m "fix(i18n): Arabic, Turkish, Czech, Slovak quality review"
```

---

### Task 18: Batch C — Korean, Japanese, Vietnamese, Simplified Chinese (parallel)

**Korean (ko) brief:**
```
Native Korean translator reviewing src/i18n/ko/messages.po against src/i18n/en/messages.po.
Known issues: "Help others recognize you" — subject was flipped in translation, fix it.
"instead" dropped in some strings.
"계정이 보안되어" unnatural — rephrase to natural Korean.
RegistrationPersister temporal clause garbled — check and fix.
Translate all 37 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Japanese (ja) brief:**
```
Native Japanese translator reviewing src/i18n/ja/messages.po against src/i18n/en/messages.po.
Known issues: "Enter Quorum" translated as "入力" (input data) — should be "Quorumに入る" or "ログイン".
"Skip for now" → "後でスキップ" (skip later) — should be "今はスキップ" (skip for now).
"Yesterday at {time}" grammar pre-existing fix — verify it's correct.
セキュア vs 安全 inconsistency — unify to 安全.
Translate all 35 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Vietnamese (vi) brief:**
```
Native Vietnamese translator reviewing src/i18n/vi/messages.po against src/i18n/en/messages.po.
Known issues: "Enter Quorum" → "Nhập" (import/enter data) — should be "Tham gia Quorum" or "Vào Quorum".
"master password" → "chính xác" (exact) — should be "mật khẩu chính".
Translate all 100 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Simplified Chinese (zh-CN) brief:**
```
Native Simplified Chinese translator reviewing src/i18n/zh-CN/messages.po against src/i18n/en/messages.po.
Known issues: "通行证" (travel permit/visa) used for passkey — should be "通行密钥" or "密码密钥".
"Skip for now" → "稍后跳过" (skip later) — should be "暂时跳过".
Word order issues in conditional sentences.
Translate all 6 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

- [ ] **Step 18.1:** Dispatch all 4 subagents in parallel
- [ ] **Step 18.2:** Review all 4 change summaries
- [ ] **Step 18.3:** Spot-check key strings
- [ ] **Step 18.4:** Commit all 4 files

```bash
git add src/i18n/ko/messages.po src/i18n/ja/messages.po src/i18n/vi/messages.po src/i18n/zh-CN/messages.po
git commit -m "fix(i18n): Korean, Japanese, Vietnamese, Simplified Chinese quality review"
```

---

### Task 19: Batch D — Indonesian, Italian, Danish, Polish (parallel)

**Indonesian (id) brief:**
```
Native Indonesian translator reviewing src/i18n/id/messages.po against src/i18n/en/messages.po.
Known issues: "kunci sandi" vs "kunci akses" vs "passkey" — 3 terms for passkey, unify to "kunci akses" or loanword "passkey".
"Enter Quorum" = "Masuk" (sign in) — same word used for both login and enter, differentiate.
Translate all 106 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Italian (it) brief:**
```
Native Italian translator reviewing src/i18n/it/messages.po against src/i18n/en/messages.po.
Known issues: "Benvenuto" is masculine only — use "Benvenuto/a" or gender-neutral phrasing.
"chiave account" vs "chiave dell'account" — unify to "chiave dell'account".
"Nessun'email" → "Nessuna email".
Translate all 121 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Danish (da) brief:**
```
Native Danish translator reviewing src/i18n/da/messages.po against src/i18n/en/messages.po.
Known issues: "kontokey" (10 instances) → "kontonøgle".
"nøglenopsætning" for passkey setup — use "opsætning af adgangsnøgle" or simpler phrasing.
English "timed out" left untranslated — translate to "forbindelsen er udløbet" or similar.
"adgangskodeanmodning" for passkey — unify terminology.
Translate all 96 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

**Polish (pl) brief:**
```
Native Polish translator reviewing src/i18n/pl/messages.po against src/i18n/en/messages.po.
Known issues: "Jestes" → "Jesteś" (missing ogonek diacritic) — find all missing diacritics.
"żaden platforma" → "żadna platforma" (platforma is feminine).
Check all diacritics throughout (ą, ę, ó, ś, ź, ż, ć, ń, ł).
Translate all 106 empty msgstr "" entries. Fix any other quality issues.
Edit the file directly. Return a bullet list of every string changed.
```

- [ ] **Step 19.1:** Dispatch all 4 subagents in parallel
- [ ] **Step 19.2:** Review all 4 change summaries
- [ ] **Step 19.3:** Spot-check key strings
- [ ] **Step 19.4:** Commit all 4 files

```bash
git add src/i18n/id/messages.po src/i18n/it/messages.po src/i18n/da/messages.po src/i18n/pl/messages.po
git commit -m "fix(i18n): Indonesian, Italian, Danish, Polish quality review"
```

---

### Task 20: Pirate English (en-PI) — Tone + coverage

**Files:** `src/i18n/en-PI/messages.po`, reference `src/i18n/en/messages.po`

Special case: this is a fun/personality locale. Issues are different.

**Subagent brief:**
```
You are reviewing src/i18n/en-PI/messages.po — the Pirate English locale of a messaging app.
Read src/i18n/en/messages.po as the source.

This locale should:
- Have pirate-flavored translations that are FUN but not hostile or offensive
- Use nautical/pirate vocabulary (Ahoy, matey, ye, arr, landlubber, etc.)
- Never contain actual insults or hostile language directed at the user
- Cover ALL strings with pirate flavor — plain English strings need to be pirate-ified
- Contain NO Spanish strings (language contamination from previous errors)

Tasks:
1. Remove all hostile insults ("ye bilge rat", "ye scallywag" etc.) — replace with friendly pirate flavor
2. Find and remove any Spanish strings that don't belong
3. Find plain English strings that weren't given pirate treatment — add pirate flavor
4. Maintain functional clarity — users must still be able to use the app

Edit the file directly. Return a bullet list of every string changed and why.
```

- [ ] **Step 20.1:** Dispatch Sonnet subagent for Pirate English
- [ ] **Step 20.2:** Review change summary — pay special attention to tone
- [ ] **Step 20.3:** Spot-check a sample for tone and fun factor
- [ ] **Step 20.4:** Commit

```bash
git add src/i18n/en-PI/messages.po
git commit -m "fix(i18n): Pirate English tone, hostile insult removal, coverage"
```

---

### Task 21: Phase 3 complete — Update audit report

- [ ] **Step 21.1:** Update `.agents/reports/2026-04-14-i18n-onboarding-translation-audit.md`
  - Add "## Phase 3 Quality Pass — [date]" section
  - List all 17 languages reviewed, issues found, changes made
  - Update the "Not Fixed" section — cross off completed items
  - Update the "State at End of This Session" block with new date and string counts
- [ ] **Step 21.2:** Commit

```bash
git add .agents/reports/2026-04-14-i18n-onboarding-translation-audit.md
git commit -m "docs: update i18n audit report after Phase 3 quality pass"
```

---

## Phase 4 — Compile and Verify

After all edits are done, compile the Lingui messages and verify no errors.

### Task 22: Compile all locales

- [ ] **Step 22.1:** Run Lingui compile

```bash
npx lingui compile
```

Expected: Compilation success for all 32 locales (en, en-PI, defaultLocale + 30 target languages). Any errors indicate malformed PO syntax — fix before proceeding.

- [ ] **Step 22.2:** If compile errors, identify which file(s) and fix syntax (unmatched braces, malformed msgstr, etc.)
- [ ] **Step 22.3:** Run linting

```bash
yarn lint
```

- [ ] **Step 22.4:** Commit compiled output if any `.js` catalog files were updated

```bash
git add src/i18n/
git commit -m "chore(i18n): compile all locales after quality pass"
```

---

## Phase 5 — Final Report Update

### Task 23: Comprehensive audit report update

- [ ] **Step 23.1:** Update `.agents/reports/2026-04-14-i18n-onboarding-translation-audit.md` with:
  - New executive summary reflecting the full quality pass
  - Updated "State at End of This Session" block with current date, string counts, 0 untranslated
  - "## Full Quality Pass Complete — [date]" section summarising all phases
  - A new "Remaining Known Limitations" section for anything still imperfect
- [ ] **Step 23.2:** Commit

```bash
git add .agents/reports/2026-04-14-i18n-onboarding-translation-audit.md
git commit -m "docs: final i18n audit report update after full quality pass"
```

---

## Progress Tracker

| Phase | Languages | Status |
|-------|-----------|--------|
| Phase 1 — Critical | el, he, no, fi, sl, sr, uk | - [ ] Not started |
| Phase 2 — High severity | de, nl, sv, th, ro, zh-TW | - [ ] Not started |
| Phase 3A — Medium | es, fr, pt, ru | - [ ] Not started |
| Phase 3B — Medium | ar, tr, cs, sk | - [ ] Not started |
| Phase 3C — Medium | ko, ja, vi, zh-CN | - [ ] Not started |
| Phase 3D — Medium | id, it, da, pl | - [ ] Not started |
| Phase 3E — Special | en-PI | - [ ] Not started |
| Phase 4 — Compile | all | - [ ] Not started |
| Phase 5 — Report | — | - [ ] Not started |

---

*Created: 2026-04-20*
*Last updated: 2026-04-20*
