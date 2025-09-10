---
description: Translate gettext .po files in src/i18n/
argument-hint: [language-codes] (e.g., 'es it' or leave empty for all)
allowed-tools: Read, Edit, MultiEdit, Glob
---

Translate untranslated entries in gettext .po files located in `src/i18n/`. 

Arguments: $ARGUMENTS
- If no arguments provided, translate ALL languages (in this case use a specialized Task agent to process all files quicker)
- If arguments provided, translate only those language codes (e.g., "es it fr")

**CRITICAL TRANSLATION RULES:**

❗️ NEVER translate these words even in sentences:
- Quorum, Quilibrium, Emoji, Emojis, useWebSocket, WebSocketProvider

❗️ PRESERVE EXACTLY (do not translate):
- Curly braces `{}` placeholders: `{username}`, `{maxFileSize}`, etc.
- Angle brackets `<>` markup: `<0>Click here</0>`, `<1>text</1>`, etc.
- All punctuation and spacing around placeholders

**SPECIAL RULES:**
- "Space" (capitalized) = app concept like Discord servers. Translate as proper noun: "Espacio", "Spazio", "Espace"
- Language code `en-PI` = Pirate English: use nautical slang, pirate grammar, but preserve meaning

**PROCESS:**
1. Find .po files for the specified languages (or all if no args)
2. Look for entries where `msgstr ""` is empty or identical to `msgid` 
3. For each untranslated entry, translate the `msgid` text into the target language
4. Update the `msgstr` line with the translation
5. Maintain exact .po file formatting and preserve all comments

**EXAMPLE:**
```
msgid "Hello {username}, welcome to Space"
msgstr ""
```
Becomes:
```
msgid "Hello {username}, welcome to Space" 
msgstr "Hola {username}, bienvenido al Espacio"
```

Focus only on entries needing translation. Keep all file structure, comments, and headers intact.