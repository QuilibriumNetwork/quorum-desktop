# Input & Textarea Validation Reference

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

This document provides a quick reference for all input and textarea validations implemented across the application. For detailed security analysis, see [security.md](./security.md).

## Validation Types & Limits

### Character Length Limits

| Input Type | Limit | Threshold Display | Constant | Files |
|------------|-------|------------------|----------|-------|
| **Message Content** | 2500 chars | 80% (2000 chars) | `MAX_MESSAGE_LENGTH` | `validation.ts:47`<br>`useMessageValidation.ts`<br>`MessageComposer.tsx`<br>`MessageComposer.native.tsx` |
| **Display Names** | 40 chars | N/A | `MAX_NAME_LENGTH` | `validation.ts:35`<br>`useDisplayNameValidation.ts`<br>Onboarding, User Settings & Space Settings modals |
| **Space Names** | 40 chars | N/A | `MAX_NAME_LENGTH` | `validation.ts:35`<br>`useSpaceNameValidation.ts`<br>`CreateSpaceModal.tsx` |
| **Topics/Descriptions** | 80 chars | N/A | `MAX_TOPIC_LENGTH` | `validation.ts:41`<br>Channel & Space settings |
| **Mention Display Names** | 200 chars | N/A | Hardcoded | `MessageMarkdownRenderer.tsx:203` |

### Content Security Validation

| Validation Type | Rule | Blocked Patterns | Purpose | Files |
|-----------------|------|------------------|---------|-------|
| **XSS Prevention** | `DANGEROUS_HTML_PATTERN` | `<` + letter/`/`/`!`/`?` | Prevent HTML tag injection | `validation.ts:38`<br>`validateNameForXSS()` |
| **Mention Count Limit** | Max 20 mentions | N/A | Prevent notification spam | `mentionUtils.ts`<br>`useMessageComposer.ts` |
| **Token Breaking** | Auto-removal | `>>>` | Prevent token injection | `MessageMarkdownRenderer.tsx:203` |

**Allowed Safe Patterns**: `<3` (heart), `>_<` (emoticon), `->`, `<-` (arrows), `<<`, `>>`, `<>`, quotes (`"`, `'`).

**Blocked Dangerous Patterns**: `<script>`, `<img`, `</div>`, `<!--`, `<?xml` - anything that starts an HTML tag.

### Reserved Name Validation (Display Names Only)

Protects against impersonation and mention conflicts. **Only applies to user display names**, not space/channel/group names.

| Validation Type | Names Protected | Strategy | Purpose |
|-----------------|-----------------|----------|---------|
| **Mention Conflict** | `everyone`, `here`, `mod`, `manager` | Exact match only (case insensitive) | Prevent conflict with @mentions |
| **Anti-Impersonation** | `admin`, `administrator`, `moderator`, `support` | Homoglyph + Word Boundary | Prevent staff impersonation |

#### Homoglyph Protection (Anti-Impersonation Only)

Characters mapped to letters: `0→o`, `1→i`, `3→e`, `4→a`, `5→s`, `7→t`, `@→a`, `$→s`, `!→i`, `|→l`

**Examples - BLOCKED:**
| Input | Normalized | Reason |
|-------|------------|--------|
| `admin` | `admin` | Exact match |
| `ADM1N` | `admin` | Homoglyph (1→i) + case |
| `@dmin` | `admin` | Homoglyph (@→a) |
| `admin team` | `admin team` | Word boundary (space) |
| `moderator123` | `moderator123` | Word boundary (numbers) |
| `supp0rt 24/7` | `support 24/7` | Homoglyph + boundary |

**Examples - ALLOWED:**
| Input | Reason |
|-------|--------|
| `sysadmin` | Embedded, no word boundary |
| `supporting` | Embedded, no word boundary |
| `padministrator` | Embedded, no word boundary |
| `everyone loves me` | "everyone" not exact match |
| `3very0ne` | No homoglyph check for "everyone" |
| `here we go` | "here" not exact match |
| `h3r3` | No homoglyph check for "here" |
| `mod team` | "mod" not exact match |
| `m0d` | No homoglyph check for "mod" |
| `manager position` | "manager" not exact match |
| `m4nager` | No homoglyph check for "manager" |

#### Implementation Details
The `isImpersonationName()` function uses THREE checks to catch all variations:
1. **Original lowercase** with word boundaries → catches "admin123", "admin-team", "blah-administrator"
2. **Homoglyph-normalized** with word boundaries → catches "adm1n", "@dmin", "supp0rt"
3. **Starts/ends check** on normalized string → catches "m0derat0r123" where trailing digits become letters after normalization

#### Implementation Files
- `validation.ts`: `HOMOGLYPH_MAP`, `IMPERSONATION_NAMES`, `MENTION_RESERVED_NAMES`, `normalizeHomoglyphs()`, `isImpersonationName()`, `isMentionReserved()`, `getReservedNameType()`, `isReservedName()`
- `useDisplayNameValidation.ts`: Uses `getReservedNameType()` for validation

### Address & ID Validation

| Type | Format | Validation | Files |
|------|--------|------------|-------|
| **IPFS Addresses** | `Qm[44 chars]` | Base58 + CID format | `validation.ts:109-154`<br>`isValidIPFSCID()` |
| **Channel IDs** | IPFS CID format | Same as addresses | `validation.ts:182`<br>`isValidChannelId()` |

## Validation Implementation

### Core Validation Files

```
src/utils/validation.ts
├── Constants: MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, MAX_TOPIC_LENGTH
├── XSS Functions: validateNameForXSS(), sanitizeNameForXSS()
├── Reserved Names: HOMOGLYPH_MAP, IMPERSONATION_NAMES, MENTION_RESERVED_NAMES
│   ├── normalizeHomoglyphs() - Convert lookalike chars to letters
│   ├── isImpersonationName() - Check with homoglyph + word boundary
│   ├── isMentionReserved() - Check exact "everyone"/"here" match
│   ├── getReservedNameType() - Returns 'mention' | 'impersonation' | null
│   └── isReservedName() - Simple boolean check
├── IPFS Functions: isValidIPFSCID(), isValidChannelId()
└── Error Helpers: getXSSValidationError()
```

### Validation Hooks

```
src/hooks/business/validation/
├── useMessageValidation.ts     → Message length + 80% threshold logic
├── useDisplayNameValidation.ts → Display name XSS + length + RESERVED NAME validation
├── useSpaceNameValidation.ts   → Space name XSS + length (NO reserved name check)
└── index.ts                    → Exports all validation hooks
```

### UI Integration Points

#### Message Composer
- **Files**: `MessageComposer.tsx`, `MessageComposer.native.tsx`, `useMessageComposer.ts`
- **Validations**:
  - Character count with 80% threshold display (2000/2500 chars)
  - Bold red counter when over limit
  - Send button disabled when over limit
  - Mention count validation (max 20)
- **UX**: Unified error display (counter | separator | error messages)

#### User Settings & Onboarding
- **Files**: `Onboarding.tsx`, `UserSettingsModal.tsx`, `SpaceSettingsModal/Account.tsx`, `useOnboardingFlowLogic.ts`, `useSpaceProfile.ts`
- **Validations**:
  - XSS protection (blocks `< > " '`)
  - Length limit (40 chars)
  - Reserved name validation:
    - `everyone` - exact match only (mention conflict)
    - `admin`, `administrator`, `moderator`, `support` - with homoglyph + word boundary (anti-impersonation)
- **UX**: Real-time validation with error messages

#### Space Management
- **Files**: `CreateSpaceModal.tsx`, `SpaceSettingsModal.tsx`, `useSpaceCreation.ts`
- **Validations**: Space name XSS + length (40 chars)
- **UX**: Validation on blur and submit

#### Channel & Topic Fields
- **Files**: Various channel and space settings components
- **Validations**: Topic/description length (80 chars)
- **UX**: Character count display near limit

## Message Composer Character Limit Details

### Implementation Flow
1. **Hook**: `useMessageValidation(message)` calculates validation state
2. **Logic**: 80% threshold = `Math.floor(2500 * 0.8) = 2000` characters
3. **Display**: Counter shows when `messageLength >= 2000`
4. **Styling**:
   - Normal: `color: var(--color-text-subtle)`
   - Over limit: `color: var(--color-text-danger)` + `font-weight: bold`
5. **Submission**: Blocked in `useMessageComposer.ts` when `isOverLimit = true`

### Responsive Behavior
- **Desktop**: Counter | separator | errors (horizontal layout)
- **Mobile** (≤480px): Counter above errors (vertical stacking)
- **Send button**: Disabled + grayed out when over limit

### Cross-Platform Consistency
- **Web**: CSS variables for colors (`--color-text-danger`, `--color-text-subtle`)
- **Native**: Theme colors (`theme.colors.text.danger`, `theme.colors.text.subtle`)
- **Logic**: Shared `useMessageValidation` hook ensures identical behavior

## Security Integration

### Layered Defense (from security.md)
1. **Input Validation** → This document's validations
2. **Placeholder Tokens** → Safe mention rendering
3. **React Auto-Escaping** → JSX attribute protection

### Regex DoS Protection
- **Display name limits**: 200 chars max in mention tokens
- **Bounded quantifiers**: `{0,200}`, `{1,50}` instead of `*`, `+`
- **Token sanitization**: Remove `>>>` characters automatically

### Rate Limiting
- **Mention extraction**: Max 20 mentions per message
- **Submission blocking**: Graceful error in MessageComposer

## Quick Reference Commands

### Check Current Validation State
```bash
# Search for validation usage
grep -r "MAX_MESSAGE_LENGTH\|MAX_NAME_LENGTH" src/
grep -r "validateNameForXSS\|useMessageValidation" src/
grep -r "isOverLimit\|shouldShowCounter" src/
```

### Common Validation Patterns
```typescript
// Message validation
const messageValidation = useMessageValidation(message);
const isValid = !messageValidation.isOverLimit;

// Name validation
const isValidName = validateNameForXSS(name) && name.length <= MAX_NAME_LENGTH;

// Address validation
const isValidAddress = isValidIPFSCID(address);
```

## Recent Updates

### 2025-11-23: Pattern-Based XSS Validation (Major Relaxation)
- **Change**: Replaced character-based blocking with pattern-based detection
  - Old: `DANGEROUS_HTML_CHARS = /[<>"']/` (blocked all `<`, `>`, `"`, `'`)
  - New: `DANGEROUS_HTML_PATTERN = /<[a-zA-Z\/!?]/` (only blocks HTML tag starts)
- **Reason**:
  - Quotes and standalone angle brackets are safely handled by React's JSX auto-escaping
  - HTML5 spec requires `<` immediately followed by letter for tag recognition
  - Unicode lookalikes are NOT parsed as HTML tags by browsers
- **User Benefit**: Now allowed:
  - Emoticons: `<3`, `>_<`, `>.<`
  - Arrows: `->`, `<-`, `=>`, `<=`
  - Decorative: `<<Name>>`, `>>quote`
  - Quotes: `O'Brien`, `"The Legend"`
- **Still Blocked**: `<script>`, `<img`, `</div>`, `<!--`, `<?xml`
- **Security Safeguards**:
  - Fixed `SearchService.highlightSearchTerms` with proper HTML and regex escaping
  - Security analyst verified all attack vectors are covered
- **Files Modified**:
  - `src/utils/validation.ts`: New `DANGEROUS_HTML_PATTERN`, updated functions
  - `src/services/SearchService.ts`: Added `escapeHtml()` and `escapeRegex()` methods

### 2025-11-21: Enhanced Reserved Name Validation with Anti-Impersonation
- **Issue**: Only "everyone" was blocked; impersonation attempts like "admin", "supp0rt" were allowed
- **Solution**: Two-tier validation system:
  1. **Mention Keywords** (`everyone`, `here`, `mod`, `manager`) - Simple exact match (case insensitive) for @mention conflicts
  2. **Anti-impersonation** (`admin`, `administrator`, `moderator`, `support`) - Homoglyph normalization + word boundary detection
- **Homoglyph Protection**: Maps lookalike characters (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s, !→i, |→l) - Only for anti-impersonation
- **Word Boundary**: Allows embedded words (e.g., "sysadmin", "supporting") but blocks separated words (e.g., "admin team", "moderator123")
- **Scope**: Only applies to user display names (not space/channel/group names)
- **Files Modified**:
  - `src/utils/validation.ts`: Added `HOMOGLYPH_MAP`, `IMPERSONATION_NAMES`, `MENTION_RESERVED_NAMES`, `normalizeHomoglyphs()`, `isImpersonationName()`, `isMentionReserved()`, `getReservedNameType()`, `isReservedName()`
  - `src/hooks/business/validation/useDisplayNameValidation.ts`: Updated to use `getReservedNameType()` with type-specific error messages

### 2025-11-19: Space Settings Modal Validation Fix
- **Issue**: SpaceSettingsModal Account.tsx was missing proper display name validation
- **Fix**: Added `useDisplayNameValidation` hook to both Account.tsx component and useSpaceProfile.ts hook
- **Impact**: Now includes XSS protection, 40-character limit, and reserved name ("everyone") validation
- **Files Modified**:
  - `src/components/modals/SpaceSettingsModal/Account.tsx`: Added proper validation hook usage
  - `src/hooks/business/spaces/useSpaceProfile.ts`: Updated to use `useDisplayNameValidation` instead of basic empty check

## Testing Scenarios

### Character Limits
- [ ] Message exactly at 2000 chars → Counter appears
- [ ] Message exactly at 2500 chars → Send button disabled
- [ ] Message at 2501+ chars → Bold red counter + disabled send
- [ ] Display name at 40+ chars → Validation error
- [ ] Space name at 40+ chars → Validation error

### XSS Prevention
- [ ] Name with `<script>` → Blocked with error message
- [ ] Name with `<img>` → Blocked with error message
- [ ] Name with `</div>` → Blocked with error message
- [ ] Name with `<!--` → Blocked with error message
- [ ] Name with `<3` → Allowed (heart emoticon)
- [ ] Name with `>_<` → Allowed (emoticon)
- [ ] Name with `->` or `<-` → Allowed (arrows)
- [ ] Name with `<<` or `>>` → Allowed (decorative)
- [ ] Name with `&` → Allowed (safe character)
- [ ] Name with `"` → Allowed (React auto-escapes)
- [ ] Name with `'` → Allowed (e.g., `O'Brien`)
- [ ] International chars → Allowed (émojis, 北京, etc.)

### Address Validation
- [ ] Valid IPFS CID → Accepted
- [ ] Invalid format → Validation error
- [ ] Wrong length → Validation error

### Reserved Name Validation (Display Names Only)
**Mention Keywords - Exact Match:**
- [ ] `everyone` → Blocked
- [ ] `Everyone` → Blocked (case insensitive)
- [ ] `EVERYONE` → Blocked
- [ ] `everyone loves me` → Allowed (not exact match)
- [ ] `3very0ne` → Allowed (no homoglyph check for everyone)
- [ ] `here` → Blocked
- [ ] `Here` → Blocked (case insensitive)
- [ ] `HERE` → Blocked
- [ ] `here we go` → Allowed (not exact match)
- [ ] `h3r3` → Allowed (no homoglyph check for here)
- [ ] `mod` → Blocked
- [ ] `Mod` → Blocked (case insensitive)
- [ ] `MOD` → Blocked
- [ ] `mod team` → Allowed (not exact match)
- [ ] `m0d` → Allowed (no homoglyph check for mod)
- [ ] `manager` → Blocked
- [ ] `Manager` → Blocked (case insensitive)
- [ ] `MANAGER` → Blocked
- [ ] `manager position` → Allowed (not exact match)
- [ ] `m4nager` → Allowed (no homoglyph check for manager)

**Anti-Impersonation - Homoglyph + Word Boundary:**
- [ ] `admin` → Blocked
- [ ] `ADM1N` → Blocked (homoglyph 1→i)
- [ ] `@dmin` → Blocked (homoglyph @→a)
- [ ] `admin team` → Blocked (word boundary)
- [ ] `moderator123` → Blocked (word boundary)
- [ ] `supp0rt` → Blocked (homoglyph 0→o)
- [ ] `sysadmin` → Allowed (embedded)
- [ ] `supporting` → Allowed (embedded)
- [ ] `padministrator` → Allowed (embedded)

## Related Documentation

- **Security Details**: [security.md](./security.md)
- **Architecture**: Message validation in useMessageComposer hook integration
- **Task History**: `.agents/tasks/.done/` - Character limit implementation
- **Validation Constants**: `src/utils/validation.ts`

---

_Created: 2025-11-19_
_Last Updated: 2025-11-23 (Pattern-based XSS validation; allows emoticons, arrows, quotes; fixed SearchService XSS)_
_Verified: 2025-12-09 - File paths confirmed current_