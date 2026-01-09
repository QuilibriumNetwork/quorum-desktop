---
type: bug
title: Markdown Line Break Inconsistency
status: open
created: 2026-01-09T00:00:00.000Z
updated: 2025-01-21T00:00:00.000Z
---

# Markdown Line Break Inconsistency

**Date:** 2025-01-21
**Status:** Identified
**Priority:** Medium

## Description

There's an inconsistency in how line breaks are handled between plain text messages and markdown-enabled messages in the MessageMarkdownRenderer.

## Current Behavior

**Plain text with single line breaks** (renders correctly):
```
test1
test2
test3
test4
```
↳ Renders with each item on a separate line

**Markdown links with single line breaks** (renders incorrectly):
```
[test1](https://example.com)
[test2](https://example.com)
[test3](https://example.com)
[test4](https://example.com)
```
↳ Renders all links on the same line

**Mixed content** (renders incorrectly):
```
test1
[test2](https://example.com)
test3
[test4](https://example.com)
```
↳ Renders everything on one line

## Root Cause

When `shouldUseMarkdown()` detects markdown patterns, it switches to `MessageMarkdownRenderer` which uses ReactMarkdown with remarkGfm. This follows strict markdown rules where single line breaks are treated as soft breaks (spaces), while plain text rendering preserves line breaks as-is.

## Expected Behavior

Both plain text and markdown content should handle single line breaks consistently - either both should preserve them as hard breaks or both should treat them as soft breaks.

## Workarounds

Users can:
1. Use double line breaks between items
2. Use list syntax with `-` or `*`
3. Add two spaces at the end of each line

## Potential Solutions

1. **Install remark-breaks plugin** - Makes ReactMarkdown treat single line breaks as hard breaks
2. **Custom preprocessing** - Convert single line breaks to double line breaks in markdown content
3. **Unified handling** - Make plain text follow markdown rules instead

## Files Affected

- `src/components/message/MessageMarkdownRenderer.tsx`
- `src/hooks/business/messages/useMessageFormatting.ts`
- `src/components/message/Message.tsx`

---
*Last updated: 2025-01-21*
