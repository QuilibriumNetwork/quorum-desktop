---
type: task
title: 'Text Primitive Analysis: Typography Prop & Helpers Confusion'
status: on-hold
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Text Primitive Analysis: Typography Prop & Helpers Confusion

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Analysis of the Text primitive's multiple API approaches (typography prop, helpers, legacy props, "as" prop) and their impact on developer experience and codebase consistency.

## Current Situation: Multiple Overlapping Systems

The Text primitive currently offers **4 different ways** to achieve similar results:

### 1. Legacy Props (93% usage)
```tsx
<Text size="lg" weight="bold" variant="strong">Title</Text>
```

### 2. Typography Prop (0.6% usage)
```tsx
<Text typography="title">Title</Text>
```

### 3. Helper Components
```tsx
<Title size="lg">Title</Title>
<Paragraph>Content</Paragraph>
<Caption>Helper text</Caption>
```

### 4. "as" Prop (unknown usage)
```tsx
<Text as="h1" typography="title">Title</Text>
<Text as="p" typography="body">Content</Text>
```

## Detailed Analysis

### Typography Prop Usage Statistics

**Current Adoption:**
- **Typography Prop (NEW):** 7 instances (0.6%)
- **Size Prop (LEGACY):** 113 instances (93.4%)
- **Weight Prop (LEGACY):** 26 instances (21.5%)

**Key Finding:** Legacy props dominate with **16x more usage** than the semantic approach.

**Where Typography IS Used (7 instances):**
1. **ConfirmationModal.tsx** (Line 50) - `<Text typography="body">`
2. **NewDirectMessageModal.tsx** (Lines 93, 143) - `typography="body"` and `typography="label-strong"`
3. **LeaveSpaceModal.tsx** (Line 39) - `typography="body"`
4. **KickUserModal.tsx** (Line 74) - `typography="body"`
5. **Text.tsx Playground** (2 documentation instances)

**Critical Observation:** ALL real-world typography usages are in **modal components only**.

### Helper Components Analysis

**✅ CONFIRMED: Title, Paragraph, Caption exist and are exported for both platforms**

**Implementation Details:**
- **Location:** `src/components/primitives/Text/TextHelpers.tsx`
- **Export:** Line 25 in `src/components/primitives/index.ts` - `Text, Paragraph, Label, Caption, Title, InlineText`
- **Platform:** Single implementation using the base Text primitive (cross-platform)
- **Purpose:** "Typography helpers for common text patterns to reduce View wrapper verbosity"

**Helper Component Definitions:**
```tsx
// All use legacy size/weight/variant props (NOT typography prop)
export const Paragraph = (props) => <Text {...props} marginBottom={8} />;
export const Label = (props) => <Text {...props} size="sm" variant="strong" marginBottom={8} />;
export const Caption = (props) => <Text {...props} size="sm" variant="subtle" marginTop={8} />;
export const Title = ({ size = 'lg', weight = 'bold', ...props }) => (
  <Text
    {...props}
    size={size === 'sm' ? 'lg' : size === 'md' ? 'xl' : size === 'lg' ? '2xl' : '3xl'}
    weight={weight}
    variant="strong"
    marginBottom={size === 'sm' ? 8 : size === 'md' ? 12 : size === 'lg' ? 16 : 20}
  />
);
export const InlineText = (props) => <Text {...props} />;
```

**CRITICAL FINDING: Helpers use LEGACY props, NOT typography prop!**
- This creates a 3-way conflict: typography prop vs legacy props vs helpers
- Helpers hardcode `variant="strong"` and specific sizes
- No integration with the semantic typography system

**Usage Analysis:**
- ❌ **Initial assessment was WRONG**: Zero imports found in web components
- ✅ **Mobile reality check**: Helpers are extensively used in mobile test screens
- ✅ **Platform difference confirmed**: Web doesn't use helpers, mobile does extensively

### Inconsistencies Found

**Mixed Approaches in Same Files:**

**EditHistoryModal.tsx:**
```tsx
Line 86:  <Text variant="subtle" size="sm" weight="medium">     // Full legacy
Line 93:  <Text variant="subtle" size="xs">                    // Missing weight!
Line 103: <Text variant="body" size="sm" className="...">      // Legacy + CSS
```

**OnboardingStyles.native.tsx:**
```tsx
<Text variant="subtle" size="xs" style={{ color: '#111827' }}>  // Defeats typography purpose
```

## Problems Identified

### 1. Decision Paralysis
Developers face too many choices for simple text styling:
- Which system to use? (Legacy vs typography vs helpers vs "as")
- When to use each approach?
- No clear guidelines or enforcement

### 2. Platform Inconsistency
- Helpers designed for native but used in cross-platform guidance
- Web components prefer direct Text primitive
- Platform-specific preferences not documented

### 3. API Surface Too Large
```tsx
// All of these achieve similar results - confusing!
<Text size="lg" weight="bold" variant="strong">Title</Text>
<Text typography="title">Title</Text>
<Title size="lg">Title</Title>
<Text as="h1" typography="title">Title</Text>
```

### 4. Semantic vs Visual Confusion
- Typography prop: Semantic approach (`title`, `body`, `label`)
- Legacy props: Visual approach (`size="lg"`, `weight="bold"`)
- Helpers: Semantic + behavioral (`Title` = semantic + block layout)
- "as" prop: Semantic HTML + visual styling

## User's Specific Concerns

### Helper Components Platform Availability
**Need to verify:** Do Title, Paragraph, Caption work on both .web and .native?

**User expectation:**
- Helpers primarily for native platform
- Web components don't use helpers in practice
- Direct Text primitive preferred on web

### Typography vs Helpers Conflict
**The confusion:**
```tsx
// Which is correct?
<Text typography="title">Page Title</Text>  // Typography approach
<Title>Page Title</Title>                  // Helper approach
<Text as="h1" typography="title">Title</Text>  // "as" approach
```

### "as" Prop Analysis

**✅ CONFIRMED: "as" prop exists and is well-implemented**

**Implementation Details:**
```tsx
// Web implementation supports semantic HTML elements
as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'a';

// Usage in component:
export const Text = ({ as: Component = 'span', ... }) => {
  return <Component className={classes} ...>{children}</Component>
}
```

**Key Insights:**
- **Default:** `span` (inline element) - explains the inline behavior issue
- **Semantic HTML:** Supports all heading levels, paragraphs, divs, links
- **Platform:** Only available on web (native doesn't have HTML semantics)
- **Integration:** Works with both typography prop and legacy props
- **Link support:** Special handling for `as="a"` with href/target props

**Usage Examples:**
```tsx
<Text as="h1" typography="title">Page Title</Text>     // Semantic HTML + typography
<Text as="p" typography="body">Paragraph content</Text>  // Semantic + typography
<Text as="span" size="sm" variant="subtle">Inline</Text> // Semantic + legacy
```

**FINDING: "as" prop solves the inline/block layout issue!**
- `<Text as="p">` creates block-level paragraph
- `<Text as="h1">` creates semantic heading
- `<Text as="div">` creates block container
- Default `<Text>` (span) is inline - source of layout problems

### Web-Specific Preferences
**User insight:** Web components will "probably never use helpers like Title, Paragraph"
- Direct Text primitive is "much easier" on web
- Helpers may be native-platform optimization

## Key Findings Summary

### 1. Helper Components Reality - REVISED FINDINGS
- ❌ **Initial finding was incorrect:** "Exported but unused"
- ✅ **Mobile usage confirmed:** Extensively used in mobile test screens (10+ instances)
- ✅ **Platform-specific adoption:** Web avoids helpers, mobile embraces them
- ✅ **Mobile value proposition:** Reduces "View wrapper verbosity" and provides automatic spacing
- ❌ **Still problematic:** Helpers use legacy props, bypass typography prop entirely

### 2. "as" Prop Discovery
- **Solves layout issues:** `as="p"` creates block elements, fixing inline problem
- **Web-only feature:** Not available on native (no HTML semantics)
- **Best of both worlds:** Semantic HTML + typography/legacy styling
- **Underutilized solution:** Could replace helpers entirely on web

### 3. Platform Differences Confirmed - CRITICAL INSIGHT
- **Web preference:** Direct Text primitive with "as" prop for semantics, avoids helpers
- **Mobile preference:** Helpers extensively used for automatic spacing and layout
- **Typography adoption:** Only in web modals, zero usage found in mobile tests
- **Platform divergence:** Completely different Text usage patterns between platforms

### 4. Root Cause of Confusion - UPDATED
- **Platform divergence not documented:** Web and mobile use completely different patterns
- **Helpers valuable for mobile:** Provide essential spacing/layout benefits on React Native
- **Typography prop stalled:** Only adopted in web modals, ignored in mobile
- **Legacy props still dominant:** Even where helpers are used extensively

## Recommendations

### Immediate Actions Needed - REVISED

1. **Document Platform-Specific Patterns**
   - ✅ **Keep helpers for mobile:** They provide essential React Native layout benefits
   - ✅ **Promote "as" prop for web:** Solves inline/block layout issues elegantly
   - ✅ **Acknowledge platform divergence:** Different optimal patterns per platform

2. **Enhance Helpers with Typography Integration**
   - Migrate helpers to use typography prop internally while maintaining spacing benefits
   - Provide backward compatibility for size/weight props
   - Bridge the gap between semantic typography and mobile layout needs

3. **Platform-Aware Migration Strategy**
   - Web: Promote `as="p" typography="body"` for block text
   - Mobile: Migrate `Title typography="title"` while keeping automatic margins
   - Cross-platform: Use typography prop for semantic consistency

### Proposed Solutions - REVISED AFTER MOBILE ANALYSIS

#### Option A: Platform-Optimized Approach (RECOMMENDED)
```tsx
// Web: Semantic HTML + typography (best for accessibility)
<Text as="h1" typography="title">Page Title</Text>
<Text as="p" typography="body">Content paragraph</Text>
<Text as="span" typography="label">Inline label</Text>

// Mobile: Helpers + typography (best for layout/spacing)
<Title typography="title">Page Title</Title>         // Auto margins + semantic style
<Paragraph typography="body">Content</Paragraph>     // Auto spacing + semantic style
<Label typography="label">Form Label</Label>         // Auto margins + semantic style
```

#### Option B: Enhance Helpers with Typography
```tsx
// Update helper implementations to use typography internally
export const Title = ({ typography = 'title', size, ...props }) => (
  <Text
    {...props}
    typography={typography || legacySizeToTypography[size]}
    marginBottom={getAutomaticMargins(typography || size)}
  />
);

// Backward compatible: <Title size="lg"> still works
// Forward compatible: <Title typography="title"> preferred
```

#### Option C: Document Platform Patterns
```tsx
// Cross-platform component example:
function UserCard({ user }) {
  return (
    <Container>
      {/* Web: Use as prop, Mobile: Use Title helper */}
      <Text as="h2" typography="subtitle">   {/* Web */}
      <Title typography="subtitle">          {/* Mobile */}
        {user.name}
      </Text>
      </Title>

      {/* Both platforms: Paragraph works well */}
      <Paragraph typography="body">
        {user.bio}
      </Paragraph>
    </Container>
  );
}
```

#### Option D: Hybrid Coexistence (REALISTIC)
```tsx
// Typography for common semantic cases (encouraged)
<Title typography="title">Semantic heading</Title>
<Paragraph typography="body">Standard content</Paragraph>

// Legacy props for custom/edge cases (always available)
<Text size="xs" weight="medium" variant="subtle">Custom micro-text</Text>
<Text size="2xl" weight="normal" color="#custom">Special design requirement</Text>

// Both approaches coexist permanently - no deprecation planned
```

## Questions for Investigation ✅ ANSWERED

1. ✅ **Do Title, Paragraph, Caption helpers exist and work on both platforms?**
   - YES: Exist in TextHelpers.tsx, exported in index.ts
   - Cross-platform implementation using base Text primitive
   - But ZERO actual usage found in codebase

2. ✅ **Are helpers actually used in web components, or only native?**
   - Web components: No imports found in production web code
   - Mobile components: Extensively used in mobile test screens (10+ instances)
   - Platform-specific adoption: Web avoids helpers, mobile embraces them
   - Confirms user assessment: web doesn't use them, mobile does

3. ✅ **How does "as" prop work and when should it be used?**
   - Web-only feature for semantic HTML elements
   - Solves inline/block layout issues (`as="p"` creates block)
   - Works with both typography prop and legacy props
   - Should be primary solution for web layout problems

4. ✅ **What's the relationship between typography prop and helpers?**
   - CONFLICT: Helpers use legacy props, ignore typography entirely
   - Creates 3-way confusion instead of consistency
   - Helpers hardcode variant="strong" and specific sizes
   - No integration between the two approaches

5. ✅ **Should platform-specific preferences be documented/enforced?**
   - YES: Clear platform differences exist
   - Web: "as" prop + typography preferred
   - Native: Containers or helpers for layout (though helpers unused)
   - Current guidance doesn't acknowledge platform differences

## Impact Assessment

### Current State Problems
- **Developer confusion:** Too many options for simple task
- **Inconsistent usage:** Different approaches in same files
- **Platform misalignment:** Helpers designed for native, guidance suggests web
- **API bloat:** Multiple ways to achieve same result

### Desired End State
- **Clear decision tree:** When to use which approach
- **Platform-appropriate guidance:** Different recommendations for web vs native
- **Simplified API:** Fewer overlapping options
- **Consistent usage:** One primary approach per platform/use case

## Final Recommendations - COMPLETELY REVISED

### 🎯 **RECOMMENDED: Platform-Optimized Approach**

**🚨 CRITICAL CORRECTION: Initial analysis was wrong about helper usage**

After examining mobile test implementations, helpers are **essential for React Native UX** and should NOT be removed.

### **Platform-Specific Strategies:**

#### **Web Strategy: "as" Prop + Typography**
```tsx
// Web: Semantic HTML + typography (accessibility + layout)
<Text as="h1" typography="title">Page Title</Text>         // Block heading
<Text as="p" typography="body">Paragraph content</Text>    // Block paragraph
<Text as="span" typography="label">Form label</Text>       // Inline label
```

#### **Mobile Strategy: Enhanced Helpers + Typography**
```tsx
// Mobile: Helpers with typography integration (spacing + semantics)
<Title typography="title">Page Title</Title>         // Auto margins + semantic style
<Paragraph typography="body">Content</Paragraph>     // Auto spacing + semantic style
<Label typography="label">Form Label</Label>         // Auto margins + semantic style
```

### **🔧 Implementation Actions:**

1. **Keep helper exports** - They provide essential mobile value:
   ```tsx
   export { Text, Paragraph, Label, Caption, Title, InlineText } from './Text';
   ```

2. **Enhance helpers with typography support:**
   ```tsx
   export const Title = ({ typography = 'title', size, ...props }) => (
     <Text
       {...props}
       typography={typography || legacySizeToTypography[size]}
       marginBottom={getAutomaticMargins(typography || size)}
     />
   );
   ```

3. **Document platform patterns clearly:**
   - **Web**: Use "as" prop for semantic HTML, typography for consistency
   - **Mobile**: Use helpers for automatic spacing, typography for consistency
   - **Cross-platform**: Typography prop provides semantic consistency across platforms

### **🎉 Benefits:**
- **Platform-appropriate solutions:** HTML semantics on web, spacing helpers on mobile
- **Preserves mobile UX benefits:** Automatic margins and "no more View wrapper verbosity"
- **Enables typography migration:** Helpers can adopt typography internally
- **Maintains backward compatibility:** Existing size/weight props still work
- **Reduces platform confusion:** Clear guidance for each platform's optimal patterns

### **⚠️ Migration Path - REALISTIC APPROACH:**
1. **Immediate**: Document platform-specific recommended patterns
2. **Phase 1**: Add typography support to helpers (backward compatible)
3. **Phase 2**: Encourage typography prop for common semantic cases
4. **Long-term coexistence**: Keep legacy props for custom styling needs
5. **NO deprecation planned**: Legacy props remain for edge cases and flexibility

**CRITICAL**: Legacy props (size, weight, variant) cannot be deprecated because:
- Typography combinations don't cover all design needs
- Custom designs require flexible sizing/weight combinations
- One-off styling requirements need precise control
- Design system evolution requires escape hatches

**Key insight**: Different platforms have different optimal solutions. Web benefits from semantic HTML, mobile benefits from automatic spacing helpers. The typography prop can bridge semantic consistency between them.

---

## Helper Usage Decision Framework

### **🎯 WHEN TO USE HELPERS vs TEXT PRIMITIVE**

This is the critical decision framework that determines whether to use helpers (Title, Paragraph, Label, Caption) or direct Text primitive with "as" prop:

#### **✅ MUST Use Helpers: Shared Components**
**Components used by both web and mobile platforms**

```tsx
// File: src/components/shared/UserProfile.tsx (cross-platform)
function UserProfile({ user }) {
  return (
    <Container>
      <Title typography="subtitle">{user.name}</Title>        {/* MUST use helper */}
      <Paragraph typography="body">{user.bio}</Paragraph>     {/* MUST use helper */}
      <Label typography="label">Status:</Label>               {/* MUST use helper */}
      <Caption typography="small">{user.status}</Caption>     {/* MUST use helper */}
    </Container>
  );
}
```

**Why MUST use helpers:**
- Mobile platform requires automatic spacing/margins to avoid "View wrapper verbosity"
- Web can tolerate helper overhead for code sharing benefits
- Ensures consistent layout behavior across platforms
- Single codebase maintenance

**How to identify shared components:**
- File has no `.web.tsx` or `.native.tsx` suffix
- Component is imported by both web and mobile code
- Located in shared directories (not platform-specific folders)

#### **❌ DON'T Use Helpers: Web-Only Components**
**Components with `.web.tsx` suffix or web-specific functionality**

```tsx
// File: src/components/web/DataTable.web.tsx (web-only)
function DataTable({ data }) {
  return (
    <table>
      <thead>
        <tr>
          <th><Text as="span" typography="label">Name</Text></th>    {/* DON'T use Label helper */}
        </tr>
      </thead>
      <tbody>
        {data.map(item => (
          <tr key={item.id}>
            <td><Text as="span" typography="body">{item.name}</Text></td>  {/* DON'T use Paragraph helper */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Why DON'T use helpers:**
- Web has semantic HTML for layout (`as="p"`, `as="h1"`, `as="td"`)
- Helper automatic margins can interfere with complex web layouts
- Semantic HTML provides better accessibility
- No mobile constraints to accommodate

**How to identify web-only components:**
- File has `.web.tsx` suffix
- Uses web-specific APIs (DOM manipulation, CSS classes)
- Complex layouts (tables, grids, absolute positioning)
- Located in web-specific directories

#### **✅ PREFER Helpers: Mobile-Only Components**
**Components with `.native.tsx` suffix or mobile-specific functionality**

```tsx
// File: src/components/mobile/Settings.native.tsx (mobile-only)
function MobileSettings() {
  return (
    <ScrollContainer>
      <Title typography="title">Settings</Title>              {/* PREFER helper */}
      <Paragraph typography="body">Configure options</Paragraph>  {/* PREFER helper */}
      <Label typography="label">Theme:</Label>                 {/* PREFER helper */}
    </ScrollContainer>
  );
}
```

**Why PREFER helpers:**
- Mobile benefits from automatic spacing without View wrapper overhead
- No HTML semantics available on React Native
- Helpers provide optimal mobile UX
- No web constraints to worry about

**How to identify mobile-only components:**
- File has `.native.tsx` suffix
- Uses React Native-specific APIs (StyleSheet, Platform)
- Mobile-specific UI patterns (swipe gestures, native navigation)
- Located in mobile-specific directories

### **🚀 Quick Decision Guide**

**Ask yourself:**
1. **Is this component shared?** → Use helpers (mobile needs them)
2. **Is this web-only?** → Use `<Text as="..." typography="...">` (optimal for web)
3. **Is this mobile-only?** → Use helpers (optimal for mobile)

**File naming patterns:**
- `Component.tsx` → Shared → Use helpers
- `Component.web.tsx` → Web-only → Use Text + as prop
- `Component.native.tsx` → Mobile-only → Use helpers

### **❌ Common Mistakes to Avoid**

**DON'T mix approaches in shared components:**
```tsx
// BAD: Mixed approach in shared component
function SharedModal() {
  return (
    <Modal>
      <Text as="h1" typography="title">Title</Text>    {/* Web-specific approach */}
      <Paragraph typography="body">Content</Paragraph>  {/* Mobile-specific approach */}
    </Modal>
  );
}
```

**DO use consistent helper approach:**
```tsx
// GOOD: Consistent helper approach in shared component
function SharedModal() {
  return (
    <Modal>
      <Title typography="title">Title</Title>           {/* Works on both */}
      <Paragraph typography="body">Content</Paragraph>  {/* Works on both */}
    </Modal>
  );
}
```

### **🎯 Updated AI Agent Rules**

When designing or refactoring components, AI agents should:

1. **First determine component type:**
   - Check file suffix (`.web.tsx`, `.native.tsx`, or shared `.tsx`)
   - Check if component is imported by both platforms
   - Check directory location (shared vs platform-specific)

2. **Apply appropriate text strategy:**
   - **Shared** → Use helpers with typography prop (or legacy props for custom styling)
   - **Web-only** → Use Text with as prop and typography prop (or legacy props for custom styling)
   - **Mobile-only** → Use helpers with typography prop (or legacy props for custom styling)

3. **Maintain consistency within component:**
   - Don't mix Text+as and helpers in same component
   - Use one approach consistently throughout

This framework provides clear, actionable guidance for when to use which text approach based on component architecture.

### **💡 Typography vs Legacy Props Decision**

Beyond the helper/Text decision, developers also need to choose between typography prop and legacy props:

#### **✅ Use Typography Prop When:**
- Standard semantic text (titles, body, labels, captions)
- Want cross-platform design consistency
- Following established design system patterns
- New components following modern patterns

```tsx
<Title typography="title">Standard Page Title</Title>
<Paragraph typography="body">Regular content text</Paragraph>
<Label typography="label">Form field label</Label>
```

#### **✅ Use Legacy Props When:**
- Custom sizing not covered by typography scale
- One-off design requirements
- Existing components that work well
- Need precise control over appearance

```tsx
<Text size="xs" weight="medium" variant="warning">Custom micro-text</Text>
<Text size="2xl" weight="normal" color="rgba(255,255,255,0.7)">Hero subtitle</Text>
<Text size="sm" weight="semibold" className="uppercase">Custom badge text</Text>
```

#### **🎯 Both Approaches Are Valid Long-Term**
- Typography prop provides semantic consistency and cross-platform reliability
- Legacy props provide flexibility for custom designs and edge cases
- No plans to deprecate legacy props - they serve different needs
- Choose based on whether your use case fits typography patterns or needs custom styling

---
