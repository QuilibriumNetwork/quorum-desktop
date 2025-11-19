# Input & Textarea Validation Reference

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

This document provides a quick reference for all input and textarea validations implemented across the application. For detailed security analysis, see [security.md](./security.md).

## Validation Types & Limits

### Character Length Limits

| Input Type | Limit | Threshold Display | Constant | Files |
|------------|-------|------------------|----------|-------|
| **Message Content** | 2500 chars | 80% (2000 chars) | `MAX_MESSAGE_LENGTH` | `validation.ts:47`<br>`useMessageValidation.ts`<br>`MessageComposer.tsx`<br>`MessageComposer.native.tsx` |
| **Display Names** | 40 chars | N/A | `MAX_NAME_LENGTH` | `validation.ts:35`<br>`useDisplayNameValidation.ts`<br>Onboarding & Settings modals |
| **Space Names** | 40 chars | N/A | `MAX_NAME_LENGTH` | `validation.ts:35`<br>`useSpaceNameValidation.ts`<br>`CreateSpaceModal.tsx` |
| **Topics/Descriptions** | 80 chars | N/A | `MAX_TOPIC_LENGTH` | `validation.ts:41`<br>Channel & Space settings |
| **Mention Display Names** | 200 chars | N/A | Hardcoded | `MessageMarkdownRenderer.tsx:203` |

### Content Security Validation

| Validation Type | Rule | Blocked Characters | Purpose | Files |
|-----------------|------|-------------------|---------|-------|
| **XSS Prevention** | `DANGEROUS_HTML_CHARS` | `< > " '` | Prevent script injection | `validation.ts:29`<br>`validateNameForXSS()` |
| **Mention Count Limit** | Max 20 mentions | N/A | Prevent notification spam | `mentionUtils.ts`<br>`useMessageComposer.ts` |
| **Token Breaking** | Auto-removal | `>>>` | Prevent token injection | `MessageMarkdownRenderer.tsx:203` |

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
├── IPFS Functions: isValidIPFSCID(), isValidChannelId()
└── Error Helpers: getXSSValidationError()
```

### Validation Hooks

```
src/hooks/business/validation/
├── useMessageValidation.ts     → Message length + 80% threshold logic
├── useDisplayNameValidation.ts → Display name XSS + length validation
├── useSpaceNameValidation.ts   → Space name XSS + length validation
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
- **Files**: `Onboarding.tsx`, `UserSettingsModal.tsx`, `useOnboardingFlowLogic.ts`
- **Validations**: Display name XSS + length (40 chars)
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

## Testing Scenarios

### Character Limits
- [ ] Message exactly at 2000 chars → Counter appears
- [ ] Message exactly at 2500 chars → Send button disabled
- [ ] Message at 2501+ chars → Bold red counter + disabled send
- [ ] Display name at 40+ chars → Validation error
- [ ] Space name at 40+ chars → Validation error

### XSS Prevention
- [ ] Name with `<script>` → Blocked with error message
- [ ] Name with `">` → Blocked with error message
- [ ] Name with `&` → Allowed (safe character)
- [ ] International chars → Allowed (émojis, 北京, etc.)

### Address Validation
- [ ] Valid IPFS CID → Accepted
- [ ] Invalid format → Validation error
- [ ] Wrong length → Validation error

## Related Documentation

- **Security Details**: [security.md](./security.md)
- **Architecture**: Message validation in useMessageComposer hook integration
- **Task History**: `.agents/tasks/.done/` - Character limit implementation
- **Validation Constants**: `src/utils/validation.ts`

---

_Created: 2025-11-19_
_Last Updated: 2025-11-19_