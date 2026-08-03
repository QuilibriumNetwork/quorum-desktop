---
type: task
title: Replace FontAwesome with Tabler Icons
status: done
created: 2025-10-23T00:00:00.000Z
updated: '2026-01-09'
---

# Replace FontAwesome with Tabler Icons


**Priority**: High
**Estimated Time**: 8-12 hours

## Overview

Replace FontAwesome icon library with Tabler Icons across the entire application (web and mobile). Tabler Icons provides a modern, consistent, open-source icon set with 5000+ icons designed on a 24×24 grid with 2px stroke width. This migration will improve visual consistency and provide better cross-platform support.

## Why Tabler Icons?

- **Modern design**: Clean, outlined style with consistent stroke widths
- **Large collection**: 5000+ MIT-licensed icons
- **Cross-platform**: Native support for both React (`@tabler/icons-react`) and React Native (`@tabler/icons-react-native`)
- **Customization**: Easy size, stroke, and color customization
- **Tree-shakeable**: ES module architecture for optimal bundle size
- **Active maintenance**: Regular updates and community support

## Current State Analysis

### Current Icon System

**Web Implementation** (`Icon.web.tsx`):
- Uses `@fortawesome/react-fontawesome` wrapper
- Imports icons from `@fortawesome/free-solid-svg-icons` and `@fortawesome/free-regular-svg-icons`
- Size mapping: xs/sm/md/lg/xl/2xl/3xl/4xl/5xl → FontAwesome sizes
- Supports: rotation, flip, spin, pulse, fixedWidth

**Mobile Implementation** (`Icon.native.tsx`):
- Uses `react-native-vector-icons/FontAwesome`
- Size mapping: xs=12, sm=14, md=16, lg=20, xl=24, 2xl=32, 3xl=48, 4xl=64, 5xl=96
- Wraps clickable icons in TouchableOpacity

**Icon Mapping** (`iconMapping.ts`):
- ~120 semantic icon names mapped to FontAwesome icons
- Separate mappings for web (`fontAwesomeIconMap`) and native (`reactNativeIconMap`)
- Type-safe with `IconName` union type in `types.ts`

### Files Using Icons

Currently using FontAwesome in:
- `src/components/primitives/Icon/Icon.web.tsx`
- `src/components/primitives/Icon/Icon.native.tsx`
- `src/components/primitives/Icon/iconMapping.ts`
- `src/components/user/UserStatus.tsx`
- `src/components/user/UserProfileEdit.tsx`
- `src/components/ui/CloseButton.tsx`
- `src/components/message/ActionMenuItem.tsx`
- `src/components/context/RegistrationPersister.tsx`

## Tabler Icons Research

### Installation

**Web (React)**:
```bash
yarn add @tabler/icons-react
```

**Mobile (React Native / Expo)**:
```bash
cd mobile && yarn add @tabler/icons-react-native
```

### API & Props

Each Tabler icon component supports:

| Prop   | Type   | Default      | Description                           |
|--------|--------|--------------|---------------------------------------|
| size   | number | 24           | Width and height in pixels            |
| color  | string | currentColor | Stroke color                          |
| stroke | number | 2            | Stroke width                          |

Additional SVG props can be passed (strokeLinejoin, className, etc.)

### Default Behavior

- **Default size**: 24×24px with 2px stroke
- **Stroke scaling**: When you change size, stroke scales proportionally (standard SVG behavior)
- **Example**: size=48 → stroke automatically scales to ~4px (48/24 × 2)
- **Icon naming**: PascalCase with "Icon" prefix (e.g., `IconArrowLeft`, `IconCheck`)

## Implementation Strategy

### Decision: User-Selected Approach

Based on user requirements:

✅ **Stroke Width**: Use default proportional scaling (stroke scales with icon size)
✅ **Implementation**: Create wrapper component with smart defaults
✅ **Missing Icons**: Find closest visual match in Tabler set
✅ **Playground Gallery**: Show only mapped icons (not all 5000+)

### Phase 1: Package Installation & Setup (1 hour)

1. **Install packages**:
   ```bash
   # Web packages (from root)
   yarn add @tabler/icons-react

   # Mobile packages (from mobile directory)
   cd mobile && yarn add @tabler/icons-react-native
   ```

2. **Verify installations**:
   - Check package.json contains `@tabler/icons-react` in root dependencies
   - Check mobile/package.json contains `@tabler/icons-react-native`

### Phase 2: Icon Mapping Research ✅ COMPLETED

**Goal**: Map all 120 current FontAwesome icons to Tabler equivalents.


**Deliverables**:
1. ✅ **`src/components/primitives/Icon/tablerIconMapping.ts`** - Complete mapping file created with all 120 icons
2. ✅ **`.agents/tasks/tabler-icon-mapping-notes.md`** - Detailed documentation of icon matches, visual differences, and recommendations

**Mapping Summary**:
- **Perfect Matches**: ~80 icons have direct Tabler equivalents
- **Close Matches**: ~30 icons have minor stylistic differences but same meaning
- **Approximate Matches**: ~10 icons have noticeable visual differences but acceptable substitutes

**Key Findings**:
- Most common icons (check, x, arrows, chevrons, user, etc.) have perfect matches
- Some icons require fallback solutions (khanda→sword, hand-peace→hand-stop)
- A few icons may need visual verification in playground (utensils, hand gestures)
- Spinner/loader needs CSS animation for rotation

**Files Created**:
- `src/components/primitives/Icon/tablerIconMapping.ts` - Full mapping with 120+ icons
- `.agents/tasks/tabler-icon-mapping-notes.md` - Detailed analysis and recommendations

### Phase 3: Icon Primitive Refactoring (3-4 hours)

#### 3.1 Update `Icon.web.tsx`

**Current approach**: Direct FontAwesome component usage
**New approach**: Wrapper that dynamically imports Tabler icons

```typescript
import React from 'react';
import * as TablerIcons from '@tabler/icons-react';
import { IconWebProps, IconSize } from './types';
import { tablerIconNames } from './tablerIconMapping';

// Convert semantic size to pixel size
const getSizeValue = (size: IconSize): number => {
  if (typeof size === 'number') return size;

  const sizeMap = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
    '5xl': 96,
  };

  return sizeMap[size] || 16;
};

export function Icon({
  name,
  size = 'md',
  color,
  className = '',
  style = {},
  disabled = false,
  id,
  onClick,
  // Note: rotation, flip, spin, pulse, fixedWidth not directly supported
  // Will need to implement via CSS transforms if needed
}: IconWebProps) {
  const tablerIconName = tablerIconNames[name];

  if (!tablerIconName) {
    console.warn(`Icon "${name}" not found in Tabler mapping`);
    return null;
  }

  const TablerIcon = (TablerIcons as any)[tablerIconName];

  if (!TablerIcon) {
    console.warn(`Tabler icon "${tablerIconName}" not found in @tabler/icons-react`);
    return null;
  }

  const iconSize = getSizeValue(size);

  // Note: stroke scales proportionally with size (Tabler default behavior)
  // 24px = 2px stroke (default)
  // 18px = 1.5px stroke (proportional)
  // 12px = 1px stroke (proportional)

  const combinedStyle = {
    ...(disabled && { opacity: 0.5 }),
    ...(onClick && { cursor: 'pointer' }),
    ...style,
  };

  return (
    <TablerIcon
      size={iconSize}
      color={color || 'currentColor'}
      className={className}
      style={combinedStyle}
      id={id}
      onClick={onClick}
    />
  );
}
```

#### 3.2 Update `Icon.native.tsx`

```typescript
import React from 'react';
import { TouchableOpacity } from 'react-native';
import * as TablerIcons from '@tabler/icons-react-native';
import { IconNativeProps, IconSize } from './types';
import { tablerIconNames } from './tablerIconMapping';
import { useTheme } from '../theme';

// Convert semantic size to pixel size (same as web)
const getSizeValue = (size: IconSize): number => {
  if (typeof size === 'number') return size;

  const sizeMap = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
    '5xl': 96,
  };

  return sizeMap[size] || 16;
};

export function Icon({
  name,
  size = 'md',
  color,
  style = {},
  disabled = false,
  onClick,
}: IconNativeProps) {
  const theme = useTheme();
  const colors = theme.colors;

  const tablerIconName = tablerIconNames[name];

  if (!tablerIconName) {
    console.warn(`Icon "${name}" not found in Tabler mapping`);
    return null;
  }

  const TablerIcon = (TablerIcons as any)[tablerIconName];

  if (!TablerIcon) {
    console.warn(`Tabler icon "${tablerIconName}" not found in @tabler/icons-react-native`);
    return null;
  }

  const iconSize = getSizeValue(size);
  const iconColor = color || colors.text.main;

  const combinedStyle = {
    ...(disabled && { opacity: 0.5 }),
    ...style,
  };

  const iconComponent = (
    <TablerIcon
      size={iconSize}
      color={iconColor}
      style={combinedStyle}
    />
  );

  // If onClick is provided, wrap in TouchableOpacity
  if (onClick && !disabled) {
    return (
      <TouchableOpacity onPress={onClick} activeOpacity={0.7}>
        {iconComponent}
      </TouchableOpacity>
    );
  }

  return iconComponent;
}
```

#### 3.3 Update `types.ts`

Remove FontAwesome-specific props that aren't supported by Tabler:

```typescript
export interface IconWebProps extends IconProps {
  // Removed: rotation, flip, spin, pulse, fixedWidth
  // These were FontAwesome-specific features
  // Can be re-implemented via CSS if needed
}
```

#### 3.4 Update `iconMapping.ts`

Rename to `tablerIconMapping.ts` and rewrite:

```typescript
import { IconName } from './types';

// Map semantic icon names to Tabler icon component names
export const tablerIconNames: Record<IconName, string> = {
  // Essential icons
  check: 'IconCheck',
  'check-circle': 'IconCircleCheck',
  'check-square': 'IconSquareCheck',
  square: 'IconSquare',
  times: 'IconX',
  close: 'IconX', // alias
  // ... (continue mapping all 120+ icons)
};

// Helper function to check if a string is a valid icon name
export function isValidIconName(name: string): name is IconName {
  return name in tablerIconNames;
}
```

### Phase 4: Playground Icon Gallery (2-3 hours)

**Goal**: Create a visual gallery showing all mapped icons in the primitives playground.

#### 4.1 Create Icon Gallery Component

**File**: `src/dev/primitives-playground/examples/IconGallery.tsx`

```tsx
import React, { useState } from 'react';
import { Icon } from '@/components/primitives';
import { tablerIconNames } from '@/components/primitives/Icon/tablerIconMapping';
import { IconName } from '@/components/primitives/Icon/types';

export const IconGallery: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const iconEntries = Object.keys(tablerIconNames) as IconName[];

  const filteredIcons = iconEntries.filter(iconName =>
    iconName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 border border-default rounded-lg bg-surface-0 text-main"
        />
        <span className="text-sm text-subtle">
          {filteredIcons.length} / {iconEntries.length} icons
        </span>
      </div>

      <div className="grid grid-cols-6 gap-4 p-4 bg-surface-0 rounded-lg border border-default max-h-[400px] overflow-y-auto">
        {filteredIcons.map((iconName) => (
          <div
            key={iconName}
            className="flex flex-col items-center gap-2 p-3 hover:bg-surface-1 rounded-lg cursor-pointer transition-colors"
            title={iconName}
          >
            <Icon name={iconName} size="xl" />
            <span className="text-xs text-subtle text-center leading-tight max-w-full truncate">
              {iconName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### 4.2 Add Gallery to Playground

**File**: `src/dev/primitives-playground/examples/Icon.tsx`

```tsx
import React, { useState } from 'react';
import { Icon } from '@/components/primitives';
import { ExampleBox } from '../ExampleBox';
import { IconGallery } from './IconGallery';
import primitivesConfig from '../primitivesConfig.json';

export const IconExamples: React.FC = () => {
  const config = primitivesConfig.icon;
  const [dynamicProps, setDynamicProps] = useState<Record<string, any>>({
    size: config.dynamicProps.size?.default || 'md',
  });
  const [showGallery, setShowGallery] = useState(false);

  return (
    <div id={config.id}>
      <ExampleBox
        title={config.title}
        description={config.description}
        columns={config.columns as 1 | 2 | 3 | 4}
        background={config.background as any}
        dynamicProps={config.dynamicProps}
        onDynamicPropsChange={setDynamicProps}
        notes={{
          quickTips: config.quickTips,
          codeExample: config.codeExample,
        }}
      >
        {config.staticExamples.map((example, index) => (
          <div key={index} className="flex flex-col items-center gap-2 p-3">
            <Icon
              {...example.props}
              {...dynamicProps}
            />
            <span className="text-xs text-subtle">
              name="{example.props.name}"
            </span>
          </div>
        ))}
      </ExampleBox>

      {/* Icon Gallery Dropdown */}
      <div className="mt-4">
        <button
          onClick={() => setShowGallery(!showGallery)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Icon name={showGallery ? 'chevron-up' : 'chevron-down'} size="sm" />
          {showGallery ? 'Hide' : 'Show'} Full Icon Set
        </button>

        {showGallery && (
          <div className="mt-4">
            <IconGallery />
          </div>
        )}
      </div>
    </div>
  );
};
```

### Phase 5: Testing & Validation (1-2 hours)

#### 5.1 Visual Regression Testing

1. **Web Testing**:
   - Start dev server: `yarn dev`
   - Navigate to `/playground#icon-primitive`
   - Verify all icons render correctly
   - Test icon gallery search functionality
   - Check different sizes (xs through 5xl)
   - Verify colors (default, custom, disabled)

2. **Mobile Testing** (if possible):
   - Start mobile app: `yarn mobile`
   - Navigate to primitives playground
   - Verify icons render on mobile
   - Test touch interactions with clickable icons

#### 5.2 Functional Testing

Test icon usage in real components:
- **UserStatus.tsx**: Online/offline status icons
- **UserProfileEdit.tsx**: Edit icons
- **CloseButton.tsx**: Close (X) icon
- **ActionMenuItem.tsx**: Action icons in message context menu
- **Navigation**: Arrow, chevron icons

#### 5.3 Type Checking

Run TypeScript compiler:
```bash
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"
```

### Phase 6: Cleanup & Documentation (1 hour)

#### 6.1 Remove FontAwesome Dependencies

```bash
# Remove packages
yarn remove @fortawesome/fontawesome-svg-core @fortawesome/free-regular-svg-icons @fortawesome/free-solid-svg-icons @fortawesome/react-fontawesome

# Remove from mobile (if installed there)
cd mobile && yarn remove react-native-vector-icons
```

#### 6.2 Delete Old Files

```bash
rm src/components/primitives/Icon/iconMapping.ts
```

#### 6.3 Update Documentation

Update `.agents/AGENTS.md` section on icons:

```markdown
### Icons

- **Location**: `src/components/primitives/Icon/`
- **Library**: Tabler Icons (@tabler/icons-react, @tabler/icons-react-native)
- **Usage**: `<Icon name="check" size="md" color="red" />`
- **Icon Gallery**: Available in primitives playground
- **Mapping**: Semantic names in `tablerIconMapping.ts`
- **Stroke Scaling**: Proportional to icon size (default Tabler behavior)
```

## Icon Mapping Reference

### High-Priority Icon Mappings

These icons are used most frequently and must be verified:

| Semantic Name | FontAwesome | Tabler Icons | Notes |
|--------------|-------------|--------------|-------|
| check | faCheck | IconCheck | ✓ Direct match |
| times / close / x | faTimes, faX | IconX | ✓ Direct match |
| chevron-* | faChevron* | IconChevron* | ✓ Direct match |
| arrow-* | faArrow* | IconArrow* | ✓ Direct match |
| bars / menu | faBars | IconMenu2 | Visual preference |
| dots | faEllipsisH | IconDots | ✓ Direct match |
| dots-vertical | faEllipsisV | IconDotsVertical | ✓ Direct match |
| cog / gear / settings | faCog, faGear | IconSettings | ✓ Direct match |
| user | faUser | IconUser | ✓ Direct match |
| users | faUsers | IconUsers | ✓ Direct match |
| search | faSearch | IconSearch | ✓ Direct match |
| spinner | faSpinner | IconLoader | Animated loader |
| trash / delete | faTrash | IconTrash | ✓ Direct match |
| edit | faEdit | IconEdit | ✓ Direct match |
| copy | faCopy | IconCopy | ✓ Direct match |
| download | faDownload | IconDownload | ✓ Direct match |
| upload | faUpload | IconUpload | ✓ Direct match |
| plus | faPlus | IconPlus | ✓ Direct match |
| minus | faMinus | IconMinus | ✓ Direct match |

### Challenging Mappings

Icons that may not have perfect Tabler equivalents:

| Semantic Name | FontAwesome | Best Tabler Match | Notes |
|--------------|-------------|-------------------|-------|
| compress-alt | faCompressAlt | IconArrowsMinimize | Close visual match |
| door-open | faDoorOpen | IconDoorExit | Slight visual difference |
| khanda / sword | faKhanda | IconSword | May need custom icon |
| hand-peace | faHandPeace | IconHandStop | Visual difference |
| cake-candles | faCakeCandles | IconCake | Simpler design |
| champagne-glasses | - | IconGlassFull | Fallback option |

## Potential Issues & Solutions

### Issue 1: Missing FontAwesome Features

**Problem**: Tabler doesn't support `rotation`, `flip`, `spin`, `pulse`, `fixedWidth` props.

**Solution**:
- For `spin`/`pulse`: Use CSS animations
- For `rotation`: Use CSS `transform: rotate()`
- For `flip`: Use CSS `transform: scaleX(-1)` or `scaleY(-1)`
- For `fixedWidth`: Apply consistent width via CSS

### Issue 2: Icon Size Differences

**Problem**: FontAwesome and Tabler icons may have slightly different visual sizes at same pixel dimensions.

**Solution**:
- Test each size visually
- Adjust size mappings if needed (e.g., md: 18 instead of 16)
- Document size differences in AGENTS.md

### Issue 3: Dynamic Icon Imports

**Problem**: `import * as TablerIcons` imports all icons, increasing bundle size.

**Solution** (future optimization):
- Create separate mapping file that imports only used icons
- Use dynamic imports with lazy loading for icon gallery
- Current approach is acceptable for MVP (tree-shaking helps)

### Issue 4: Stroke Width Preferences

**Problem**: User may want fixed stroke widths at certain sizes (e.g., always 1.5px for small icons).

**Solution** (if needed):
```typescript
// Add explicit stroke calculation
const getStrokeWidth = (size: IconSize): number => {
  const pixelSize = getSizeValue(size);
  if (pixelSize <= 16) return 1.5;
  if (pixelSize <= 24) return 2;
  return 2.5;
};

// Pass to icon
<TablerIcon stroke={getStrokeWidth(size)} />
```

## Implementation Checklist

### Phase 1: Installation ✅
- [ ] Install `@tabler/icons-react` (web)
- [ ] Install `@tabler/icons-react-native` (mobile)
- [ ] Verify package installations

### Phase 2: Icon Mapping ✅
- [x] Map all 120 semantic icon names to Tabler equivalents
- [x] Create `tablerIconMapping.ts`
- [x] Document icons without perfect matches
- [x] APPROVED: Get user approval for visual differences (review tabler-icon-mapping-notes.md)

### Phase 3: Icon Primitive Refactoring 🔧
- [ ] Refactor `Icon.web.tsx` to use Tabler
- [ ] Refactor `Icon.native.tsx` to use Tabler
- [ ] Update `types.ts` (remove FontAwesome props)
- [ ] Delete old `iconMapping.ts`

### Phase 4: Icon Gallery 🎨
- [ ] Create `IconGallery.tsx` component
- [ ] Add gallery to `Icon.tsx` playground example
- [ ] Implement search/filter functionality
- [ ] Test gallery performance with ~120 icons

### Phase 5: Testing & Validation ✅
- [ ] Visual testing in web playground
- [ ] Visual testing in mobile (if possible)
- [ ] Test icons in real components (UserStatus, CloseButton, etc.)
- [ ] Run TypeScript type checking
- [ ] Test different sizes, colors, disabled states
- [ ] Verify clickable icons work correctly

### Phase 6: Cleanup & Documentation 📚
- [ ] Remove FontAwesome packages (web)
- [ ] Remove FontAwesome packages (mobile)
- [ ] Delete old mapping file
- [ ] Update AGENTS.md documentation
- [ ] Update CLAUDE.md if needed
- [ ] Commit changes with descriptive message

## Success Criteria

- [ ] All icons render correctly on web
- [ ] All icons render correctly on mobile (if testable)
- [ ] Icon gallery displays all mapped icons with search
- [ ] No FontAwesome dependencies remain
- [ ] TypeScript compiles without errors
- [ ] No visual regressions in existing components
- [ ] Icon sizes (xs through 5xl) work as expected
- [ ] Stroke widths scale proportionally with size
- [ ] Clickable icons maintain onClick functionality
- [ ] Documentation updated with new icon system
- [ ] Performance is acceptable (no slowdown from icon rendering)

## Future Enhancements

### Optimization: Selective Icon Imports

Instead of `import * as TablerIcons`, create explicit imports:

```typescript
// tablerIconMapping.ts
import {
  IconCheck,
  IconX,
  IconChevronLeft,
  // ... import only used icons
} from '@tabler/icons-react';

export const tablerIconComponents = {
  check: IconCheck,
  times: IconX,
  close: IconX,
  'chevron-left': IconChevronLeft,
  // ...
};
```

### Enhancement: Custom Stroke Widths

Add `stroke` prop to Icon component for manual control:

```typescript
export interface IconProps {
  name: IconName;
  size?: IconSize;
  stroke?: number; // NEW: optional stroke width override
  color?: string;
  // ...
}
```

### Enhancement: Icon Animations

Add support for spin/pulse animations:

```typescript
export interface IconProps {
  name: IconName;
  size?: IconSize;
  spin?: boolean; // NEW: CSS animation for loaders
  pulse?: boolean; // NEW: CSS pulse animation
  // ...
}
```

## Risk Assessment

### High Risk
- **Visual differences**: Some Tabler icons may look different from FontAwesome
  - *Mitigation*: Map carefully, get user approval, document differences

### Medium Risk
- **Bundle size increase**: Importing entire Tabler library
  - *Mitigation*: Tree-shaking helps, optimize later with selective imports

### Low Risk
- **Breaking changes**: Icon component API stays mostly the same
  - *Mitigation*: Removed props are FontAwesome-specific and rarely used
- **Mobile compatibility**: @tabler/icons-react-native is officially supported
  - *Mitigation*: Official package, should work seamlessly

## Timeline Estimate

| Phase | Time | Dependencies |
|-------|------|-------------|
| 1. Installation | 1 hour | None |
| 2. Icon Mapping | 2-3 hours | Phase 1 |
| 3. Refactoring | 3-4 hours | Phase 2 |
| 4. Gallery | 2-3 hours | Phase 3 |
| 5. Testing | 1-2 hours | Phase 4 |
| 6. Cleanup | 1 hour | Phase 5 |
| **Total** | **10-14 hours** | Sequential |

## Notes

- **Mobile testing limitation**: Mobile app is not currently being tested, so visual validation will focus on web
- **Stroke scaling decision**: Using default proportional scaling (stroke scales with icon size) per user preference
- **Wrapper approach**: Creating smart Icon component wrapper per user preference
- **Missing icons**: Finding closest visual matches in Tabler set per user preference
- **Gallery scope**: Showing only mapped icons (~120) per user preference

---

_Task created: 2025-10-23_
_Last updated: 2025-10-23_
