---
type: bug
title: Emoji panel inserts the emoji at the start of the message instead of at the caret
status: done
created: '2026-08-06'
updated: '2026-08-06'
---

# Emoji panel inserts the emoji at the start of the message

## Symptom

Type some text in the message composer, open the emoji panel, pick an emoji.
The emoji is inserted at the very beginning of the message rather than where the
caret was.

## Status

**2026-08-06 — shipped in PR #316** (`fix(emoji): emojis land at the cursor, and one bad copy target no longer blanks every emoji image`)

What landed: the composer now remembers the last caret seen inside the editor and
restores it before inserting, so an emoji picked from the panel goes where the
cursor was. `execCommand` failure is no longer silent, and the dormant textarea
branch splices at the selection instead of appending.

Verified: reporter confirmed the behaviour in the UI; 20 unit tests with every
mutant tried going red; browser-level measurement via a throwaway Electron
harness (search-box path 3/3 fail before, 3/3 pass after).

## Root cause

`MessageComposer.insertEmoji` (contentEditable branch, the live one since
`ENABLE_MENTION_PILLS` is `true`) did:

```ts
editorRef.current.focus();
document.execCommand('insertText', false, emoji);
```

`execCommand` inserts at the current document selection, and `focus()` alone
does not reliably bring the old caret back.

Measured in Electron's Chromium (real mouse/keyboard input events, 3 repeats
per case, caret parked mid-text at "hello|world"):

| Path | Before fix |
|---|---|
| type → click smiley → click emoji | passes 3/3 |
| type → click smiley → click **search box** → click emoji | **fails 3/3** → `😀hello world` |

So a plain `<button>` does *not* cost you the caret: Chromium keeps the
editor's selection alive when focus moves to a non-editable element, and
`focus()` re-activates it. What breaks it is focus landing on a **text-editing**
element. The emoji picker has a search field (`ListSearchInput`, rendered by
`EmojiPicker`); clicking it moves the document selection *into that input*.
After that the editor owns no selection at all, so `focus()` collapses the caret
to offset 0 and the emoji lands at the start.

This corrects an earlier guess that the smiley button itself was to blame — the
harness refuted it.

## Fix

New `src/utils/composerSelection.ts` remembers the last caret that was genuinely
inside the editor (via a `document` `selectionchange` listener) and restores it
immediately before `execCommand`.

The saved caret keeps its own `anchorNode` reference rather than trusting the
`Range`. A `Range` — including a `cloneRange()` — stays *live*: when the send
path wipes the editor (`innerHTML = ''`, `MessageComposer.tsx`) the browser
rewrites the range's boundary to `(editor, 0)` instead of invalidating it, so a
range-only staleness check silently passes and would restore the caret to the
start of whatever text appears next. Holding the original node is what makes
removal detectable.

Fallback when nothing usable is saved: caret to the end of the content
(appending is what a user expects if they never placed a caret).

Also fixed the `<textarea>` branch, which is currently dormant
(`ENABLE_MENTION_PILLS === false`) but unconditionally appended the emoji to the
end regardless of the caret. It now splices at `selectionStart`/`selectionEnd`;
a blurred textarea still reports the selection it had when it lost focus.

## Review follow-ups applied

Two independent reviews raised these; all are now in:

- **`execCommand` failure was silent.** It reports failure by returning `false`
  rather than throwing, so a no-op insertion looked identical to "I clicked and
  nothing happened", with no trace. `insertEmoji` now compares the text before
  and after and `console.error`s when nothing changed.
- **The wiring was untested.** The 15 original tests only covered the pure
  helpers; nothing verified that `MessageComposer` actually calls focus →
  restore → insert in that order. The sequence moved into
  `insertTextAtSavedCaret()` so a test can exercise the real code rather than a
  copy of it, with the insert callback injectable so the test can observe the
  caret at the instant of insertion.
- **Two weak assertions.** The "detached clone" test would have passed with
  `cloneRange()` deleted (it never mutated the shared node); it now mutates the
  live range directly. And no test discriminated `commonAncestorContainer` from
  `startContainer`, so a cross-boundary selection case was added (selection
  starting inside the editor, ending outside it).
- **Textarea branch ordering** realigned to the file's existing convention
  (`setSelectionRange` then `focus`), which is what `handleMentionSelect` does.

Not changed, deliberately: no `try/catch` around `addRange`. Both reviewers
traced the call sites and agreed the `isSavedCaretUsable` gate makes a throw
unreachable today; a catch there would swallow information rather than add
safety.

## Verification

- `src/dev/tests/utils/composerSelection.unit.test.ts` — 20 tests, jsdom.
- Every mutant tested goes red, so no test passes by accident:
  - restore made a no-op (the old behaviour) → 4 failures
  - staleness guard reverted to trusting the live range → 2 failures
  - drop the restore before insert → 1 failure
  - insert before restore instead of after → 1 failure
  - drop `editor.focus()` → 1 failure
  - `startContainer` instead of `commonAncestorContainer` → 1 failure
  - drop `cloneRange()` → 1 failure
- Full suite: 79 files / 1055 tests pass. `tsc --noEmit` clean.

## What these tests do NOT prove

jsdom models neither `document.execCommand` nor the caret behaviour this fix
works around — its `focus()` never touches Selection state, and it does not even
treat a contentEditable div as focusable. So the unit tests prove the helpers
and the call ordering are correct; they cannot prove the fix works in a browser.

The browser-level evidence is a throwaway Electron harness driving real input
events (3 repeats per case), which measured the plain button→button path passing
and the search-box path failing 3/3 before the fix and passing 3/3 after. That
harness is not part of the codebase. Treat the manual UI check as load-bearing,
not optional.

## Resolved during review

Whether a saved caret could leak across channels: no. `Space.tsx` keys
`<Channel key={spaceId}-{channelId}>` and `DirectMessages.tsx` keys
`<DirectMessage key={'messages-'+address}>`, so switching remounts the composer
and `savedRangeRef` starts fresh. Likewise, multiple simultaneously-mounted
composers (Channel, ThreadPanel, DirectMessage) each install their own
document-level `selectionchange` listener, but each gates on its own
`editorRef`, so no composer can save or restore another's caret.

## Still open

Whether the reporter's own flow goes through the picker's search box. The fix is
a superset and covers every focus-loss path measured, but if an emoji still
lands at the start without the search field ever being touched, there is a
second focus-stealing path the Electron harness did not model.
