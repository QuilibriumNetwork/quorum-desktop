# Security Mechanisms

This document describes the security mechanisms implemented in the application to protect against various attack vectors. Each security mechanism is documented with the files involved for easy reference and maintenance.

---

## 1. XSS (Cross-Site Scripting) Prevention

### Overview

Implemented a **defense-in-depth** approach using three layers:

1. **Input Validation** - Block dangerous HTML characters (`< > " '`) at data entry points
2. **Placeholder Token System** - Safely render mentions without parsing user HTML
3. **React Auto-Escaping** - Built-in JSX attribute escaping as a safety net

### Attack Vectors Mitigated

- HTML injection in messages (e.g., `<script>alert('XSS')</script>`)
- Attribute injection via display names (e.g., `"><script>alert('XSS')</script>`)
- Attribute injection via space names
- Attribute injection via role names
- Phishing links via HTML tags
- UI spoofing via injected elements

### Implementation Details

#### Layer 1: Input Validation

**Core Utilities:**
- `src/utils/validation.ts` - Core validation functions (`validateNameForXSS`, `sanitizeNameForXSS`)

**Validation Hooks:**
- `src/hooks/business/validation/useDisplayNameValidation.ts` - Display name validation logic
- `src/hooks/business/validation/useSpaceNameValidation.ts` - Space name validation logic
- `src/hooks/business/validation/index.ts` - Exports validation hooks

**Applied In:**
- `src/components/onboarding/Onboarding.tsx` - Onboarding display name input
- `src/hooks/business/user/useOnboardingFlowLogic.ts` - Onboarding validation logic
- `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` - User settings display name
- `src/components/modals/CreateSpaceModal.tsx` - Space creation name input
- `src/hooks/business/spaces/useSpaceCreation.ts` - Space creation validation logic
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - Space settings validation
- `src/components/modals/SpaceSettingsModal/General.tsx` - Space settings name input

#### Layer 2: Placeholder Token System

**Core Implementation:**
- `src/components/message/MessageMarkdownRenderer.tsx` - Converts mentions to safe placeholder tokens and renders them as React components

**How It Works:**
1. User mentions (`@<address>`, `@everyone`) are converted to placeholder tokens (e.g., `<<<MENTION_USER:address>>>`)
2. ReactMarkdown processes the text (escaping all HTML by default)
3. Placeholder tokens are detected and rendered as styled React components
4. No HTML parsing occurs, preventing all HTML injection attacks

**Special Case: YouTube Embeds**

YouTube embeds use a similar safe approach without HTML parsing:

1. Standalone YouTube URLs are converted to markdown image syntax: `![youtube-embed](videoId)`
2. The markdown image component handler detects the special `alt="youtube-embed"` marker
3. Renders a safe React component (`YouTubeFacade`) instead of allowing arbitrary images
4. All other markdown images (user-typed) are blocked to prevent image-based attacks

This approach avoids whitelisting HTML `<div>` or `<iframe>` elements, which could be abused for layout manipulation or UI spoofing.

#### Layer 3: React Auto-Escaping

React automatically escapes all JSX attributes, providing an additional safety layer for any data that might bypass input validation.

### Security Guarantees

- ✅ Users **cannot** inject `<script>` tags in messages
- ✅ Users **cannot** inject `<img>` tags with `onerror` handlers
- ✅ Users **cannot** inject `<iframe>`, `<a>`, `<div>` or other HTML tags
- ✅ Users **cannot** use dangerous characters (`< > " '`) in display/space names
- ✅ Users **cannot** inject arbitrary images via markdown image syntax
- ✅ Markdown formatting still works (**bold**, *italic*, links, code blocks, etc.)
- ✅ User mentions and role mentions render correctly with styling
- ✅ YouTube embeds work securely for standalone URLs without allowing HTML elements

### Testing

Test cases and snippets available in `.agents/tasks/.done/xss-security-test-snippets.txt`

### References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [ReactMarkdown Security](https://github.com/remarkjs/react-markdown#security)
- Full implementation details: `.agents/tasks/.done/xss-prevention-final-implementation-2025-11-08.md`

---

## Future Security Mechanisms

This document will be updated as new security mechanisms are implemented.

### Planned

- End-to-end encryption validation
- Secure key storage mechanisms
- Input sanitization for other attack vectors
- Content Security Policy (CSP) headers
- Rate limiting and abuse prevention

---

**Document Created**: 2025-11-08
**Last Updated**: 2025-11-08 (Added YouTube embed security details)
