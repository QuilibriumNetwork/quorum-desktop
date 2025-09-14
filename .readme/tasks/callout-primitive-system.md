# Callout Primitive System

## Overview
Create a centralized `Callout` primitive component to provide consistent messaging across the app, replacing ad-hoc error/success messaging and console logs.

## Requirements

### Core Features
- **Cross-platform**: Web (.web.tsx) and Native (.native.tsx) versions
- **Variants**: `info`, `success`, `warning`, `danger` (using existing Tailwind color scheme)
- **Two layout modes**:
  - **Base layout**: Rounded colored border + colored background + icon (left) + text (right)
  - **Minimal layout**: Icon + colored text only (no background, no border)
- **Sizes**: `xs`, `sm` (default), `md` (using corresponding text sizes: text-xs, text-sm, text-base)

### Optional Features
- **Dismissible**: Optional closing "×" (Icon primitive "times") button in top-right corner
- **Auto-dismiss**: Optional auto-close after N seconds
- **Transitions**: Smooth appear/disappear animations

### API Design
```tsx
interface CalloutProps {
  variant: 'info' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
  layout?: 'base' | 'minimal';
  dismissible?: boolean;
  autoClose?: number; // seconds
  onClose?: () => void;
  className?: string; // web only
  testID?: string;
}
```

## Implementation Tasks

### 1. Create primitive structure
- [ ] `src/components/primitives/Callout/types.ts`
- [ ] `src/components/primitives/Callout/index.ts`
- [ ] `src/components/primitives/Callout/Callout.web.tsx`
- [ ] `src/components/primitives/Callout/Callout.native.tsx`

### 2. Web implementation
- [ ] Use existing Tailwind color variables (`danger`, `success`, `warning`, `info`)
- [ ] Implement base layout (border + background + icon + text)
- [ ] Implement minimal layout (icon + colored text only)
- [ ] Add size variants (xs, sm, md)
- [ ] Add dismiss button functionality
- [ ] Add auto-close timer
- [ ] Add CSS transitions for appear/disappear

### 3. Native implementation
- [ ] Map web styles to React Native equivalents
- [ ] Use existing color scheme from theme system
- [ ] Implement layouts using React Native components
- [ ] Add size variants
- [ ] Add dismiss functionality
- [ ] Add auto-close timer
- [ ] Add React Native animations

### 4. Icon integration
- [ ] Use existing `Icon` primitive for consistency
- [ ] Default icons per variant (check that the right icons exist in our icons map, you can also add new icons to the map if necesasry, but check that theye xist in fontawesome):
  - `info`: info-circle
  - `success`: checkmark
  - `warning`: exclamation-triangle
  - `danger`: exclamation-triangle

### 5. Export and documentation
- [ ] Add to `src/components/primitives/index.ts`
- [ ] Add TypeScript types export

### 6. Playground examples
#### Web playground (`src/dev/primitives-playground/`)
- [ ] Example for each variant: `info`, `success`, `warning`, `danger`
- [ ] Example with minimal layout (text only)
- [ ] Example with dismissible (closing ×)
- [ ] Example with `xs` size
- [ ] Example with `md` size

#### Mobile playground (`mobile/test/primitives/`)
- [ ] Create `CalloutTestScreen.tsx`
- [ ] Example for each variant: `info`, `success`, `warning`, `danger`
- [ ] Example with minimal layout (text only)
- [ ] Example with dismissible (closing ×)
- [ ] Example with `xs` size
- [ ] Example with `md` size

### 7. Audit existing implementations
- [ ] Identify other ad-hoc messaging that can use Callout (e.g )
- [ ] check in Modals (src\components\modals) - Input,Select,Textarea primitves must maintain their own success/error messages, no callout
- [ ] check in other places, e.g. InviteLink.tsx, Error messages for file uploads, etc...
- [ ] create a full audit of the potential implementations of the new Callout primitve witha list of files, current implementation of erros/success/warning message and how it could be changed
- [ ] post audit in .readme/taks


## Technical Considerations
- Follow existing primitive patterns (cross-platform, theme integration)
- Ensure accessibility (ARIA labels, screen reader support)
- Keep bundle size minimal
- Test on both desktop and mobile
- Ensure smooth animations don't impact performance

## Success Criteria
- [ ] Consistent messaging system across web and mobile
- [ ] Replaces existing ad-hoc error/success handling
- [ ] Follows established primitive component patterns
- [ ] Accessible and performant
- [ ] Well-documented with playground examples

---
*Created: 2025-09-13*