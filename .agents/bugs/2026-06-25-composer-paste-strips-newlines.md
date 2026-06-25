---
type: bug
title: "Composer flattens multi-line paste into a single line (contentEditable newlines lost)"
status: open
severity: medium
created: 2026-06-25
area: message composer
component: src/components/message/MessageComposer.tsx
related:
  - src/utils/mentionPillDom.ts (extractStorageTextFromEditor — the serializer that drops newlines)
  - src/hooks/business/mentions/useMentionPillEditor.ts (wraps the serializer)
  - src/components/message/MessageMarkdownRenderer.tsx (the renderer — NOT the cause; receives already-flattened text)
---

# Composer flattens multi-line paste into a single line

## Symptom

Pasting multi-line / multi-block markdown into the message composer and sending
it produces a message where every line is concatenated onto one line. Block
structure collapses: headers, lists, blockquotes, and tables all run together
into a single paragraph. Inline formatting (`**bold**`, `*italic*`, `~~strike~~`,
`` `code` ``) still renders correctly — only the line breaks between blocks are
lost.

Observed 2026-06-25 while smoke-testing the markdown renderer: a multi-block test
message rendered as
`Header (already H3)**Bold text** and ... Blockquote with bold inside- Unordered list item 1...`
— one flowed line. (Screenshot in session.)

## Root cause (confirmed in code)

The composer is a `contentEditable` `<div>`, not a `<textarea>`. Its content is
serialized back to a storage string by `extractStorageTextFromEditor` in
`src/utils/mentionPillDom.ts:142`. That walker handles three cases:

- text node → append `textContent`
- mention pill element → append the `@<addr>` / `#<id>` / `@roleTag` token
- any other element → **recurse into its children** (line 165)

It **never emits a `\n` for block-level elements**. When the browser pastes
multi-line text into a `contentEditable`, it represents line breaks as `<div>`
wrappers and/or `<br>` elements. The walker recurses through `<div>`s and ignores
`<br>`s, so all line breaks are dropped and the result is a single line.

The paste handler itself (`MessageComposer.tsx:315-320`) is not the culprit — it
does `e.clipboardData.getData('text/plain')` (which still contains the `\n`s) and
inserts via `document.execCommand('insertText', …)`. The newlines survive into
the DOM as block elements; they're lost only when the DOM is serialized back out
by `extractStorageTextFromEditor`.

## Regression window (when it was introduced)

This is a **regression**, not a day-one limitation. The composer has two input
modes gated by the `ENABLE_MENTION_PILLS` feature flag:

- **Flag OFF / pre-pills:** a plain `<TextArea>` whose `.value` preserves `\n`
  natively. Multi-line messages worked.
- **Flag ON:** a `contentEditable` `<div>` whose content must be serialized to a
  string by hand via `extractStorageTextFromEditor` (introduced in commit
  `36292659` "refactor: extract mention pills into shared utilities", 2026-01-09,
  which consolidated the pre-existing pill/contentEditable logic into
  `mentionPillDom.ts` + `useMentionPillEditor`).

The newline loss appears when the contentEditable pills path is active. The
serializer never handled block-element newlines, so enabling pills (or that path
becoming the default) is the regression point. There is no prior newline-aware
serializer to restore — the fix is to add `\n` reconstruction to the walker.

A secondary nit: the serializer ends with `return text.trim()` (line 171), which
also strips leading/trailing blank lines, but that's minor next to the
intra-message flattening.

## NOT related to the shared message-preprocessing migration

This was found during testing of the renderer refactor (consume shared
`messagePreprocessing` in `MessageMarkdownRenderer.tsx`), but it is independent
and pre-existing:

- The bug is in the **composer's DOM→string serialization**, upstream of the
  renderer. The renderer only ever sees the already-flattened string.
- The shared preprocessing functions perform **zero** newline-touching
  operations on the desktop path (verified: no `\n`-stripping `replace`/`split`
  in `messagePreprocessing.ts`; the only `\r\n?→\n` normalize lives in
  `prepareMessageContent`, which desktop does not call). So the refactor cannot
  add or remove this behavior.
- It reproduces identically on `main` (the serializer is unchanged by the
  refactor).

## Knock-on symptom: pasted fenced code blocks render EMPTY

A sharper failure mode of the same root cause, confirmed 2026-06-25. Pasting a
fenced code block:

```​
this fence is never closed
the renderer should still treat it as code
```​

flattens to a single line ` ``` this fence is never closed … code`. react-markdown
then reads the text after the opening ` ``` ` on the same line as the code block's
**info string (language identifier)**, not as content — so the body is empty and
the renderer shows an empty code box. The content is silently swallowed into a
bogus "language" tag.

This is NOT a bug in `fixUnclosedCodeBlocks` (shared
`messagePreprocessing.ts`) — that function is correct: given the un-flattened
multi-line input it produces a properly-closed block with content intact
(verified by tracing the function directly). It only misbehaves because it
receives already-flattened single-line input from the composer. Fixing the
newline serialization fixes this too.

When the serializer fix lands, re-verify this exact fenced-code paste case — the
info-string corruption is a distinct, easy-to-miss symptom beyond "lines run
together."

## Likely fix (to validate when we tackle it)

In `extractStorageTextFromEditor` (`mentionPillDom.ts`), emit `\n` for block
boundaries during the walk:

- Append `\n` when encountering a `<br>` element.
- Append `\n` between block-level child containers (`<div>`, `<p>`) — browsers
  wrap each visual line of a `contentEditable` in its own `<div>` after the
  first, so a `\n` before each non-first block `<div>` reconstructs the line
  structure.

Care needed:
- Don't double-count (`<div><br></div>` is a common empty-line representation —
  emitting `\n` for both the div boundary and the `<br>` would produce two
  newlines for one empty line).
- Preserve the existing pill/text/`@everyone` serialization exactly (wire format
  must not change).
- Re-check the trailing `.trim()` — switch to trimming only outer blank lines if
  intentional leading/trailing structure matters, otherwise leave as-is.
- Cross-check `extractVisualText` (uses `textContent`, same newline-loss) if any
  caller relies on it for multi-line.

Add a unit test for the serializer with a multi-`<div>` / `<br>` fixture once the
fix lands (the function is pure DOM→string and testable with jsdom).

## Repro

1. Copy a multi-line markdown block (e.g. a header line + blank line + a list).
2. Paste into the composer in any channel/DM.
3. Send.
4. Observed: one flowed line. Expected: blocks render on separate lines.

## Workaround for testing the renderer in the meantime

Send one small block at a time as separate messages (single header, single
mention, single URL each), so no message needs internal line breaks to survive.

Note: it is NOT yet verified whether *typed* multi-line input (Enter / Shift+Enter
in the composer) survives serialization — typed line breaks also become
`<div>`/`<br>` in the contentEditable, so the same serializer may flatten them too.
Confirm this when tackling the fix; until then, the only reliable workaround is
one-block-per-message.
