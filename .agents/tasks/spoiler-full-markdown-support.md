---
type: task
title: Full Markdown Support Inside Spoilers
status: in-progress
complexity: medium
created: 2026-01-06T00:00:00.000Z
updated: '2026-01-09'
---

# Full Markdown Support Inside Spoilers

> **AI-Generated**: May contain errors. Verify before use.


**Priority**: Low (implement if users request)


**Estimated Effort**: 2-3 days
**Depends On**: Spoiler basic implementation (completed)
**Files**:
- `src/components/message/MessageMarkdownRenderer.tsx`

## What & Why

The current spoiler implementation (`||text||`) only supports plain text content. If spoiler content contains URLs, code, mentions, or markdown syntax, it breaks because markdown processes the content before spoiler detection.

**User need**: Hide complex content like `||Check @user and https://example.com||` where ALL content stays hidden.

**Current workaround**: Users can break up content: `||secret:|| https://url.com`

## Recommended Approach: Pre-extraction with Map Storage

Based on feature-analyzer review, this is the lowest complexity option that fits existing patterns.

### Concept

1. **Extract spoilers FIRST** - Before any other processing in the pipeline
2. **Replace with unique placeholders** - `SPOILERPLACEHOLDER0ENDPLACEHOLDER`
3. **Store content in Map** - Preserve original spoiler content
4. **Run normal pipeline** - All processing works on placeholder text
5. **Restore in processMentionTokens** - Replace placeholders with spoiler UI
6. **Recursive processing** - Spoiler content goes through `processMentionTokens` for mentions/links

### Why This Approach

- Fits existing patterns (similar to YouTube embeds, invite cards)
- Single-pass processing, Map lookup is O(1)
- Incremental - doesn't rewrite entire system
- Testable - clear input/output at each step

---

## Implementation

### Phase 1: Spoiler Extraction Function

- [ ] **Create `extractSpoilers()` function** (`MessageMarkdownRenderer.tsx`)
    - Done when: Function extracts `||content||` and returns [processedText, Map]
    - Must protect code blocks using `getProtectedRegions()`
    ```typescript
    const extractSpoilers = (text: string): [string, Map<string, string>] => {
      const spoilerMap = new Map<string, string>();
      let counter = 0;

      const protectedRegions = getProtectedRegions(text);
      const regex = /\|\|([^|]{1,500})\|\|/g;
      const matches = Array.from(text.matchAll(regex));

      let processed = text;
      // Replace from end to preserve indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        if (!isInProtectedRegion(match.index!, protectedRegions)) {
          const placeholder = `SPOILERPLACEHOLDER${counter}ENDPLACEHOLDER`;
          spoilerMap.set(placeholder, match[1]);
          processed = processed.substring(0, match.index) +
                      placeholder +
                      processed.substring(match.index! + match[0].length);
          counter++;
        }
      }

      return [processed, spoilerMap];
    };
    ```

### Phase 2: Pipeline Integration

- [ ] **Add extraction at pipeline start**
    - Done when: Spoilers extracted before `processInviteLinks`
    - Use `useMemo` to keep Map stable across re-renders
    ```typescript
    // Extract spoilers FIRST, before any processing
    const [contentWithPlaceholders, spoilerMap] = useMemo(() => {
      return extractSpoilers(content);
    }, [content]);

    // Use contentWithPlaceholders in existing pipeline
    const processedContent = useMemo(() => {
      return fixUnclosedCodeBlocks(
        convertHeadersToH3(
          processURLs(
            // ... existing chain
            processInviteLinks(contentWithPlaceholders) // Use placeholder version
          )
        )
      );
    }, [contentWithPlaceholders, /* existing dependencies */]);
    ```

### Phase 3: Placeholder Restoration

- [ ] **Update `processMentionTokens` to handle placeholders**
    - Done when: Placeholders replaced with spoiler UI containing processed content
    - Add placeholder pattern to regex
    - Recursively process spoiler content through `processMentionTokens`
    ```typescript
    // Add to token regex:
    // SPOILERPLACEHOLDER(\d+)ENDPLACEHOLDER

    // In the matching logic:
    } else if (match[14]) { // Adjust capture group number
      const placeholderIndex = match[14];
      const placeholder = `SPOILERPLACEHOLDER${placeholderIndex}ENDPLACEHOLDER`;
      const spoilerContent = spoilerMap.get(placeholder) || '';

      parts.push(
        <span
          key={`spoiler-${match.index}`}
          className="message-spoiler"
          onClick={...}
          onKeyDown={...}
          tabIndex={0}
          role="button"
          aria-label="Click to reveal spoiler"
        >
          {processMentionTokens(spoilerContent)} {/* Recursive! */}
        </span>
      );
    }
    ```

- [ ] **Pass spoilerMap to processMentionTokens**
    - Done when: Function has access to the Map
    - Consider: Add as parameter or use context/closure

### Phase 4: Safety & Edge Cases

- [ ] **Add max recursion depth guard**
    - Prevent infinite loops from nested spoilers
    - Max depth of 3-5 should be sufficient
    ```typescript
    const processMentionTokens = (text: string, depth = 0): React.ReactNode[] => {
      if (depth > 5) return [text]; // Safety limit
      // ...
      processMentionTokens(spoilerContent, depth + 1)
    };
    ```

- [ ] **Handle escaped pipes**
    - Consider: Should `\|\|text\|\|` NOT be a spoiler?
    - Decision: Probably not needed for MVP

- [ ] **Test nested spoilers**
    - `||outer ||inner|| outer||` - define expected behavior
    - Recommendation: Inner spoiler is just text (don't nest)

---

## Verification

- [ ] **Simple text still works**: `||secret||` renders as before
- [ ] **URLs inside spoilers**: `||https://example.com||` - URL hidden, clickable when revealed
- [ ] **Mentions inside spoilers**: `||Hey @user||` - mention hidden, clickable when revealed
- [ ] **Code inside spoilers**: `||check `this` code||` - code styled when revealed
- [ ] **Bold/italic inside spoilers**: `||**bold** and *italic*||` - styled when revealed
- [ ] **Code blocks protected**: `` `||not spoiler||` `` renders as code, not spoiler
- [ ] **Performance**: No noticeable lag with many spoilers in a message
- [ ] **TypeScript compiles**: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Placeholder split by markdown | Low | High | Use highly unique pattern, test edge cases |
| Map instability across re-renders | Medium | Medium | Use `useMemo` with correct dependencies |
| Infinite recursion | Low | High | Add max depth guard |
| Performance with many spoilers | Low | Medium | Map lookup is O(1), should be fine |

---

## Decision Points

Before implementing, clarify:

1. **Nested spoilers**: What happens with `||outer ||inner|| outer||`?
   - Option A: Inner is just text (simpler)
   - Option B: Nested spoilers work (complex)

2. **Partial match**: What if only opening `||` exists?
   - Already handled: Regex requires both delimiters

3. **Empty spoilers**: What about `||||`?
   - Already handled: Regex requires content `[^|]{1,500}`

---

## Why Not Other Approaches

### Custom Remark Plugin (Option 2)
- **Rejected because**: High complexity, requires deep remark AST knowledge, harder to debug
- **Would be better if**: We had remark plugin expertise on the team

### Two-Pass Rendering (Option 3)
- **Rejected because**: Performance implications (multiple markdown parses), recursive component rendering complexity
- **Would be better if**: We needed very complex nested content support

---

## Updates

**2026-01-06 - Created**: Task created based on feature-analyzer recommendation after spoiler basic implementation was completed. Pre-extraction approach chosen as lowest complexity option that fits existing patterns.

---

**Last Updated**: 2026-01-06
