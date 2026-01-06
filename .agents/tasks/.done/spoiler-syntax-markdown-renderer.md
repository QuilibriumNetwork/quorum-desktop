# Implement Spoiler Syntax (||text||) in Markdown Renderer

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: ✅ Completed (with limitations)
**Complexity**: Medium → High (due to markdown interaction complexity)
**Created**: 2026-01-06
**Completed**: 2026-01-06
**Files**:
- `src/components/message/MessageMarkdownRenderer.tsx:294-360` (processMentions pattern)
- `src/components/message/MessageMarkdownRenderer.tsx:571-703` (processMentionTokens)
- `src/components/message/MessageMarkdownRenderer.tsx:707-725` (processing pipeline)
- `src/styles/_chat.scss:106-166` (mention styling)
- `src/hooks/business/messages/useMessageFormatting.ts:27-46` (pattern detection)
- `src/utils/markdownFormatting.ts` (toolbar utilities)
- `src/components/message/MarkdownToolbar.tsx` (formatting toolbar)

## What & Why

Users cannot hide spoiler content in messages. Implementing Discord-style `||spoiler text||` syntax allows users to hide sensitive content that recipients can reveal by clicking. This improves conversation privacy and matches user expectations from other messaging platforms.

## Context

- **Existing pattern**: Follow `processMentions()` exactly (lines 294-360) - uses protected regions, token system, reverse index replacement
- **Token system**: `<<<TOKEN_TYPE:data>>>` pattern - mentions, message links all use this
- **Nested tokens**: `processMentionTokens()` handles nested content via recursive calls
- **Security requirements**: Quantifier limits on regex (see security audit), protected region validation
- **Constraints**: Must work with mentions/links inside spoilers (recursive processing)

---

## Prerequisites
- [ ] Development environment running (`yarn dev`)
- [ ] Familiar with token system in MessageMarkdownRenderer.tsx

---

## Implementation

### Phase 1: Core Processing Function

- [ ] **Add `processSpoilers()` function** (`src/components/message/MessageMarkdownRenderer.tsx`)
    - Done when: Function converts `||text||` to `<<<SPOILER:text>>>` tokens
    - Verify: `console.log(processSpoilers("Hello ||secret|| world"))` outputs `Hello <<<SPOILER:secret>>> world`
    - Reference: Follow exact pattern from `processMentions()` at lines 294-360
    ```typescript
    // Key requirements:
    // 1. Use getProtectedRegions() to skip code blocks
    // 2. Regex with quantifier limit: /\|\|([^|]{1,500})\|\|/g
    // 3. Replace from end to beginning (reverse index order)
    // 4. Use isInProtectedRegion() check for each match
    ```

- [ ] **Integrate into processing pipeline** (`src/components/message/MessageMarkdownRenderer.tsx:707-725`)
    - Done when: `processSpoilers` called after `processMessageLinks`, before `processURLs`
    - Verify: Pipeline processes spoilers in correct order
    ```typescript
    // Current pipeline ends with:
    processURLs(
      processMessageLinks(
        processChannelMentions(...)
      )
    )

    // Change to:
    processURLs(
      processSpoilers(  // ADD HERE
        processMessageLinks(
          processChannelMentions(...)
        )
      )
    )
    ```

### Phase 2: Token Rendering (requires Phase 1)

- [ ] **Update token regex** (`src/components/message/MessageMarkdownRenderer.tsx:600-606`)
    - Done when: Regex matches `<<<SPOILER:content>>>` tokens
    - Verify: Token regex captures spoiler content in **capture group 13**
    ```typescript
    // Current regex structure has 12 capture groups (EVERYONE, USER, ROLE, CHANNEL, MESSAGE_LINK)
    // Add SPOILER as the last alternative - it will be capture group 13:
    const tokenRegex = new RegExp(
      `<<<(` +
        `MENTION_(EVERYONE|USER:...|ROLE:...|CHANNEL:...)|` +
        `MESSAGE_LINK:...|` +
        `SPOILER:([^>]{1,500})` +  // ADD THIS - capture group 13
      `)>>>`,
      'g'
    );
    ```

- [ ] **Add spoiler rendering in `processMentionTokens()`** (`src/components/message/MessageMarkdownRenderer.tsx:609-695`)
    - Done when: SPOILER tokens render as clickable span with hidden content
    - Verify: Spoiler content hidden by default, revealed on click/tap/keyboard
    - Reference: Follow pattern from other token types (USER, ROLE, CHANNEL)
    ```typescript
    } else if (match[13]) {
      // Spoiler token: <<<SPOILER:content>>>
      const spoilerContent = match[13];
      parts.push(
        <span
          key={`spoiler-${match.index}`}
          className="message-spoiler"
          onClick={(e) => {
            e.currentTarget.classList.toggle('message-spoiler--revealed');
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            // Keyboard accessibility: reveal spoiler with Enter or Space
            // This allows users navigating with Tab key to reveal spoilers
            // without needing a mouse (WCAG 2.1 compliance)
            if (e.key === 'Enter' || e.key === ' ') {
              e.currentTarget.classList.toggle('message-spoiler--revealed');
              e.stopPropagation();
              e.preventDefault(); // Prevent Space from scrolling page
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Click to reveal spoiler"
        >
          {processMentionTokens(spoilerContent)} {/* Recursive for nested tokens */}
        </span>
      );
    }
    ```

### Phase 3: Styling (requires Phase 2)

- [ ] **Add CSS for spoiler states with Telegram-style noise** (`src/styles/_chat.scss`)
    - Done when: Spoilers show animated TV-noise effect, revealed on click
    - Verify: Animation runs smoothly, looks good on both themes, inline wrapping works
    - Reference: Add after existing mention styles (lines 106-166)
    - Note: Uses `--surface-*` variables directly (no semantic variables needed for single component)
    ```scss
    /* Spoiler - Telegram-style animated noise effect */
    .message-spoiler {
      position: relative;
      color: transparent;
      border-radius: $rounded;
      padding: 0 $s-1;
      cursor: pointer;
      user-select: none;
      background-color: var(--surface-5);

      /* Animated noise overlay using CSS gradient */
      &::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background-image:
          repeating-linear-gradient(
            0deg,
            var(--surface-7) 0px,
            transparent 1px,
            transparent 2px
          ),
          repeating-linear-gradient(
            90deg,
            var(--surface-7) 0px,
            transparent 1px,
            transparent 3px
          );
        background-size: 4px 4px;
        opacity: 0.5;
        animation: spoiler-noise 150ms steps(3) infinite;
        pointer-events: none;
      }

      &:hover {
        background-color: var(--surface-6);
      }

      /* Revealed state - hide noise, show content */
      &--revealed {
        color: inherit;
        background-color: transparent;
        cursor: default;
        user-select: text;

        &::before {
          display: none;
        }
      }

      /* Accessibility: focus ring for keyboard navigation */
      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }

      /* Reduced motion preference */
      @media (prefers-reduced-motion: reduce) {
        &::before {
          animation: none;
        }
      }
    }

    /* Noise animation keyframes */
    @keyframes spoiler-noise {
      0% { background-position: 0 0, 0 0; }
      33% { background-position: 2px 1px, 1px 2px; }
      66% { background-position: 1px 2px, 2px 1px; }
      100% { background-position: 0 0, 0 0; }
    }
    ```

### Phase 4: Toolbar & Pattern Detection (requires Phase 3)

- [ ] **Add spoiler pattern detection** (`src/hooks/business/messages/useMessageFormatting.ts:27-46`)
    - Done when: `hasMarkdownPatterns()` detects `||text||` syntax
    - Verify: Messages with spoilers route to markdown renderer
    ```typescript
    // Add to markdownPatterns array:
    /\|\|[^|]+\|\|/,  // Spoiler content
    ```

- [ ] **Add `toggleSpoiler()` utility** (`src/utils/markdownFormatting.ts`)
    - Done when: Function wraps selection with `||`
    - Verify: `toggleSpoiler("secret", 0, 6)` returns `||secret||`
    - Reference: Follow `toggleBold()` pattern using `wrapSelection()`

- [ ] **Add spoiler button to toolbar** (`src/components/message/MarkdownToolbar.tsx`)
    - Done when: Spoiler button appears in toolbar, inserts `||` around selection
    - Verify: Clicking button wraps selected text with `||`
    - Reference: Follow existing button pattern (bold, italic, strikethrough)
    - Icon: Use `iconName="eye-off"` (represents hidden/spoiler content)

---

## Verification

✓ **Basic spoiler works**
    - Test: Send `||secret||` → renders as hidden content
    - Test: Click spoiler → content revealed

✓ **Mentions inside spoilers work**
    - Test: Send `||Hey @user||` → mention is clickable when revealed
    - Verify: User profile opens when clicking revealed mention

✓ **Code blocks protected**
    - Test: Send `` `||not spoiler||` `` → renders as inline code, not spoiler
    - Test: Send fenced code block with `||` → remains as code

✓ **Toolbar integration**
    - Test: Select text → click spoiler button → text wrapped with `||`

✓ **TypeScript compiles**
    - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✓ **Mobile compatible**
    - Test: Tap spoiler on mobile → content reveals
    - Verify: Touch events work correctly

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| Unclosed `\|\|text` | Renders as plain text | ✓ Regex won't match | P0 | Low |
| Empty `\|\|\|\|` | Renders as plain text (no content) | ✓ Regex requires content | P1 | Low |
| Nested `\|\|\|\|inner\|\|\|\|` | First `\|\|` pairs with second | ✓ Greedy regex | P2 | Low |
| Very long spoiler (>500 chars) | Truncated at 500 chars | ⚙️ Quantifier limit | P1 | Low |
| `\|\|` inside code block | Not processed as spoiler | ✓ Protected regions | P0 | Medium |
| Multiline `\|\|line1\nline2\|\|` | Works as single spoiler | ✓ Supported by default | P1 | Low |
| Inline wrapping across lines | Noise effect wraps naturally | ✓ CSS handles inline | P1 | Low |

**Note on multiline**: The regex `[^|]{1,500}` matches any character except `|`, including newlines. Multiline spoilers work automatically.

**Note on inline wrapping**: When a spoiler spans multiple lines inline (e.g., `text ||spoiler\ncontinues|| more`), the `<span>` naturally wraps and the CSS `::before` pseudo-element with `inset: 0` covers each line segment. The noise animation applies to the full bounding box.

---

## Definition of Done

- [x] Basic spoiler syntax works for simple text
- [x] TypeScript compiles: `npx tsc --noEmit` passes
- [x] No console errors or warnings
- [x] Toolbar button added with `eye-off` icon
- [x] CSS styling with Telegram-style noise animation
- [x] Keyboard accessibility (Enter/Space to reveal)
- [ ] ~~Full markdown support inside spoilers~~ (deferred - see limitations)
- [ ] Update `.agents/docs/features/messages/markdown-renderer.md` with spoiler documentation

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2026-01-06 - Claude**: Initial task creation based on feature-analyzer recommendations. Key decisions:
- Use preprocessing + token system (not render-phase only)
- Process after mentions so content inside spoilers is interactive
- Recursive `processMentionTokens()` call handles nested tokens
- Quantifier limit {1,500} for security (regex DoS prevention)

**2026-01-06 - Claude**: Applied corrections from feature-analyzer review:
- Specified capture group index 13 for SPOILER token
- Added keyboard accessibility (`onKeyDown` for Enter/Space keys)
- Specified icon name `eye-off` for toolbar button
- Updated multiline edge case status to "Supported by default"

**2026-01-06 - Claude**: Updated styling to Telegram-style animated noise effect:
- Replaced solid gray background with animated CSS gradient noise pattern
- Uses `--surface-*` variables directly (no semantic variables - avoids over-engineering)
- Added `@keyframes spoiler-noise` animation (150ms, 3 steps)
- Added `prefers-reduced-motion` support for accessibility
- Added `focus-visible` outline for keyboard navigation
- Colors: `--surface-5` (bg), `--surface-6` (hover), `--surface-7` (noise) - theme-aware automatically

**2026-01-06 - Claude**: ✅ Implementation completed after multiple iterations.

---

## Implementation Journey & Lessons Learned

### Approach 1: Token System (`<<<SPOILER:content>>>`) ❌

**Idea**: Follow the existing mention pattern - convert `||text||` to `<<<SPOILER:text>>>` tokens in the preprocessing pipeline.

**Problem**: Markdown interpreted `<` characters as HTML tags, corrupting tokens:
- Input: `<<<SPOILER:hello>>>`
- After markdown: `<<SPOILER:hello>>>` (one `<` eaten)

### Approach 2: Alternative Delimiters (`§§§SPOILER:content§§§`) ❌

**Idea**: Use Unicode characters that markdown won't interpret as HTML.

**Problem**: Content inside the token was still processed by markdown:
- URLs became `<a>` tags, splitting the token across multiple React nodes
- Backticks rendered as `<code>` elements, breaking the token structure
- The `||` delimiters got separated and the regex couldn't match them

### Approach 3: Base64 Encoding ❌

**Idea**: Encode spoiler content as base64 to protect it from markdown processing.

**Problem**: Poor fallback experience - if markdown was disabled or broken, users would see gibberish like `aGVsbG8gd29ybGQ=` instead of readable text.

### Approach 4: Placeholder Extraction ❌

**Idea**: Extract spoilers before markdown, replace with `SPOILERPLACEHOLDER0ENDPLACEHOLDER`, store content in a Map, restore after markdown.

**Problem**: Added significant complexity (useMemo, Map storage, placeholder matching) and still had edge cases where placeholders could be split by markdown processing.

### Approach 5 (Current): Direct Detection in processMentionTokens ✅

**Idea**: Simplest approach - detect `||text||` directly in `processMentionTokens` after markdown has processed the content.

**Implementation**:
- Added `\\|\\|([^|]{1,500})\\|\\|` to the token regex in `processMentionTokens`
- Spoiler content renders as **plain text** when revealed
- No preprocessing, no placeholders, no maps

**Limitation**: Only works when spoiler content is simple text that survives as a single text node after markdown. If the content contains URLs, code, or other markdown syntax, markdown splits it into multiple nodes and breaks the `||...||` pattern.

**Accepted Trade-off**: Spoilers work for simple text content. Complex content (URLs, mentions, code) inside spoilers is not supported. Users can still use spoilers for their primary use case: hiding short text like plot spoilers, surprise announcements, etc.

---

## Current Implementation

### Files Modified

1. **MessageMarkdownRenderer.tsx**:
   - Updated `processMentionTokens` regex to match `||content||` directly
   - Added spoiler rendering with click/keyboard reveal, accessibility attributes
   - Spoiler content renders as plain text

2. **_chat.scss**: Added `.message-spoiler` styles with Telegram-style animated noise effect

3. **useMessageFormatting.ts**: Added `/\|\|[^|]+\|\|/` to `markdownPatterns` array

4. **markdownFormatting.ts**: Added `toggleSpoiler()` function

5. **MarkdownToolbar.tsx**: Added spoiler button with `eye-off` icon

### Known Limitations

| Content Type | Works? | Notes |
|-------------|--------|-------|
| Simple text | ✅ | `||secret text||` works perfectly |
| URLs | ❌ | Markdown converts to `<a>`, breaks pattern |
| Code (backticks) | ❌ | Markdown converts to `<code>`, breaks pattern |
| Mentions | ❌ | Token system processes before spoiler detection |
| Bold/italic | ❌ | Markdown processes, may break pattern |

### Future Improvement Options

If full markdown support inside spoilers is needed:
1. **Pre-extraction approach**: Extract spoilers at the very start (before ANY processing), store in map, restore at render time
2. **Custom markdown plugin**: Write a remark plugin that handles `||...||` as a first-class syntax
3. **Two-pass rendering**: Render spoiler content separately through markdown, then wrap in spoiler UI

For now, the simple text approach covers the primary use case adequately.
