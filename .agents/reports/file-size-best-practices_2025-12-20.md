# File Size & Service Extraction Best Practices

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary

Research into software engineering best practices reveals that **file size alone is not the primary metric** for deciding when to split code. The key factors are:

1. **Cohesion** — Does all the code belong together logically?
2. **Reasons to change** — How many independent concerns does the file handle?
3. **Cognitive load** — Can a developer understand it without excessive mental effort?

A 4,000-line file with high cohesion may be acceptable; a 500-line file with multiple unrelated concerns should be split.

---

## Scope & Methodology

- **Scope**: When to split large TypeScript/React service files
- **Methodology**: Web search of authoritative sources (2024-2025)
- **Sources researched**: 15+ articles on SOLID principles, React architecture, TypeScript patterns

---

## Findings

### 1. Size Guidelines (Rules of Thumb)

| Source | Recommendation |
|--------|----------------|
| General TypeScript guidance | 100-200 lines per file |
| "Rule of 30" (Refactoring in Large Software Projects) | Classes < 30 methods, ~900 lines max |
| Martin Fowler | Split when you "can't fit it in your head" |
| Robert Martin | Admits size rules are "qualitative judgments, not empirical evidence" |

**Key insight**: These are guidelines, not hard rules. Context matters more than line counts.

### 2. The Real Metric: Single Responsibility Principle (SRP)

From Robert C. Martin (Uncle Bob):
> "A class should have only one reason to change."

**Practical application**:
- Ask: "What would cause this class to change?"
- If there are multiple independent answers, those are separate responsibilities
- Each responsibility = candidate for extraction

**God Class anti-pattern indicators**:
- Implements multiple non-cohesive functionalities
- Holds too much data across different domains
- Has methods that don't interact with each other
- New developers struggle to understand it quickly

### 3. When NOT to Split

From ArjanCodes:
> "You shouldn't break down all complex behavior into multiple classes. 'Classitis can hurt you.' Keep code together when you don't see the parts being far apart."

**Acceptable large files**:
- Utility/helper classes with related functions
- Controllers that are pure "proxies between UI and business logic"
- Highly cohesive code where everything genuinely belongs together
- Code where splitting would require passing many parameters between pieces

**Downsides of over-splitting**:
- Excessive abstraction layers increase maintenance burden
- More files = more imports = longer initial load times
- Type duplication across boundaries with TypeScript
- Harder to trace execution flow

### 4. When You MUST Split

**Clear indicators**:
- Multiple distinct "reasons to change"
- Code that's hard to test in isolation
- Methods that don't interact with each other
- Duplicate logic appearing across different concerns
- New developers can't quickly understand the file

**From Profy.dev on React architecture**:
> "As soon as the codebase grows... the UI code is tightly coupled with the data layer, you have lots of duplicate code, and the component turns into an unreadable mess of spaghetti."

### 5. Benefits of Proper Extraction

| Benefit | Description |
|---------|-------------|
| **Testability** | Isolated services can be unit tested independently |
| **Maintainability** | Changes are localized, reducing side effects |
| **Reusability** | Extracted services can be used across the codebase |
| **Onboarding** | New developers understand smaller, focused files faster |
| **Compilation** | Smaller files reduce TypeScript recompilation scope |

### 6. React Service Layer Patterns

**Recommended structure** (from multiple sources):
```
src/services/
├── api/              # API fetch functions
├── cache/            # React Query cache operations
├── business/         # Business logic services
└── utils/            # Shared utilities
```

**Key principle**: Separate concerns by their "reason to change":
- API layer changes when endpoints change
- Cache layer changes when caching strategy changes
- Business logic changes when requirements change

---

## Recommendations

### Decision Framework

Before splitting a file, answer these questions:

| Question | If Yes → | If No → |
|----------|----------|---------|
| Does it have multiple unrelated concerns? | Split by concern | Keep together |
| Can parts be tested independently? | Extract for testability | Keep if tightly coupled |
| Do different parts change for different reasons? | Split by responsibility | Keep if they change together |
| Is it hard for new developers to understand? | Split for clarity | Keep if naturally cohesive |
| Would splitting require passing 5+ parameters? | Consider keeping | Safe to split |

### Extraction Criteria Checklist

Before extracting code to a new file:

- [ ] The code has a **distinct responsibility** (different "reason to change")
- [ ] The code can be **tested independently**
- [ ] The extraction **reduces coupling**, not increases it
- [ ] The new service has a **clear, descriptive name**
- [ ] Dependencies can be **injected cleanly** (not 10+ parameters)
- [ ] The extraction provides **measurable value** (testability, reusability, clarity)

### What to Extract vs. What to Keep

**Good extraction candidates**:
- Pure utility functions
- Cache manipulation logic
- API communication layers
- Validation logic
- Transformation/mapping functions

**Keep together**:
- Tightly coupled business logic
- Code that shares significant state
- Operations that must execute atomically
- Code where the abstraction would be "leaky"

---

## Related Documentation

- [Cryptographic Code Best Practices](./cryptographic-code-best-practices_2025-12-20.md)

---

## Sources

1. [WebDevTutor - TypeScript File Structure Best Practices](https://www.webdevtutor.net/blog/typescript-file-structure-best-practices)
2. [Wikipedia - Single Responsibility Principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)
3. [LinearB - What is a God Class](https://linearb.io/blog/what-is-a-god-class)
4. [Martin Fowler - This Class is Too Large](https://martinfowler.com/articles/class-too-large.html)
5. [DZone - Rule of 30](https://dzone.com/articles/rule-30-–-when-method-class-or)
6. [Profy.dev - React Architecture Infrastructure Services](https://profy.dev/article/react-architecture-infrastructure-services-and-dependency-injection)
7. [Profy.dev - React Architecture API Layer](https://profy.dev/article/react-architecture-api-layer)
8. [TheServerSide - How to Refactor the God Object](https://www.theserverside.com/tip/How-to-refactor-the-God-object-antipattern)
9. [ArjanCodes - Class Design Best Practices in OOP](https://arjancodes.com/blog/best-practices-for-class-design-in-object-oriented-programming/)
10. [DigitalOcean - SOLID Design Principles Explained](https://www.digitalocean.com/community/conceptual-articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design)

---

_Created: 2025-12-20_
_Report Type: Research_
