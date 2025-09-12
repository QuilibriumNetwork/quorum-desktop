# AccentColorSwitcher Cross-Platform Migration + Persistence

## Task Overview

Make the existing AccentColorSwitcher component work on both web and native by fixing its web-only dependencies and integrating it with our unified theme system. Ensure complete persistence of both theme and accent color choices across sessions on both platforms.

## Current State Analysis

### Web Theme Persistence (✅ Working)

- **Theme**: Uses `localStorage.getItem('theme')` and `localStorage.setItem('theme', value)`
- **Accent**: Uses `localStorage.getItem('accent-color')` with CSS classes
- **Status**: Both persist between browser sessions correctly

### Native Theme Persistence (❌ Missing)

- **Theme**: Comments indicate "No localStorage in React Native - state management only"
- **Accent**: Same issue - no persistence mechanism
- **CRITICAL GAP**: All settings reset on app restart

### AccentColorSwitcher Current State

- **Component**: Already designed to be cross-platform (uses primitives, has platform detection)
- **Dependencies**: `ColorSwatch` and `FlexRow` are cross-platform ready
- **Platform Logic**: Uses `isNative` and `useResponsiveLayout` for responsive sizing
- **ISSUE**: Not working on native because its dependencies are web-only:
  - `useAccentColor` hook only works on web (localStorage + CSS classes)
  - `useResponsiveLayout` hook is web-only (window.innerWidth)
  - No integration with our new cross-platform theme system

### Theme System Integration

- **Web Provider**: Has theme persistence but accent is handled separately
- **Native Provider**: Has `accent` and `setAccent` but no persistence
- **Disconnect**: AccentColorSwitcher doesn't use theme providers

## Migration Plan

### Phase 1: Implement Native Persistence Infrastructure

**Goal**: Add AsyncStorage support to native theme providers

**Tasks**:

1. Install `@react-native-async-storage/async-storage` dependency
2. Update `ThemeProvider.native.tsx`:
   - Add AsyncStorage imports
   - Load theme from AsyncStorage on mount
   - Save theme to AsyncStorage in `setTheme`
   - Load accent from AsyncStorage on mount
   - Save accent to AsyncStorage in `setAccent`
3. Test persistence survives app restart

**Technical Requirements**:

```typescript
// Add to ThemeProvider.native.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

// On mount - load persisted values
useEffect(() => {
  const loadPersistedValues = async () => {
    const savedTheme =
      ((await AsyncStorage.getItem('theme')) as Theme) || 'system';
    const savedAccent =
      ((await AsyncStorage.getItem('accent-color')) as AccentColor) || 'blue';
    setThemeState(savedTheme);
    setAccentState(savedAccent);
  };
  loadPersistedValues();
}, []);

// In setTheme - persist to AsyncStorage
const setTheme = async (value: Theme) => {
  setThemeState(value);
  await AsyncStorage.setItem('theme', value);
};

// In setAccent - persist to AsyncStorage
const setAccent = async (value: AccentColor) => {
  setAccentState(value);
  await AsyncStorage.setItem('accent-color', value);
};
```

### Phase 2: Unified AccentColor Management

**Goal**: Remove separate useAccentColor hook, use theme providers exclusively

**Tasks**:

1. **Delete obsolete useAccentColor hook**:
   - Remove `src/hooks/business/ui/useAccentColor.ts`
   - Update exports in `src/hooks/business/ui/index.ts`

2. **Update Web Theme Provider**:
   - Add accent color management to web theme context
   - Sync localStorage accent-color with theme.setAccent
   - Remove direct CSS manipulation from external hooks
   - Ensure CSS classes still update when accent changes

3. **Verify Native Theme Provider**:
   - Confirm `accent` and `setAccent` work correctly
   - Test colors update when accent changes

**Technical Requirements**:

```typescript
// Update ThemeProvider.web.tsx interface
interface ThemeContextType {
  theme: Theme;
  setTheme: (value: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  accent: AccentColor; // Add accent support
  setAccent: (value: AccentColor) => void; // Add setAccent
}

// Add accent state and persistence
const [accent, setAccentState] = useState<AccentColor>('blue');

const setAccent = (value: AccentColor) => {
  setAccentState(value);
  localStorage.setItem('accent-color', value);

  // Update CSS classes
  ACCENT_COLORS.forEach((c) => {
    document.documentElement.classList.remove(`accent-${c}`);
  });
  document.documentElement.classList.add(`accent-${value}`);
};
```

### Phase 3: Cross-Platform useResponsiveLayout

**Goal**: Make useResponsiveLayout work on both platforms

**Options**:

1. **Platform-specific implementations**:
   - Keep existing web version (window.innerWidth, resize events)
   - Create native version: return static values (always mobile-like)
2. **Cross-platform abstraction**:
   - Use Dimensions API from React Native for native
   - Keep window API for web

**Recommendation**: Option 1 (simpler, AccentColorSwitcher only uses `isMobile` for sizing)

**Tasks**:

1. Create `useResponsiveLayout.native.ts`:

```typescript
export const useResponsiveLayout = (): ResponsiveLayoutState => {
  return {
    isMobile: true, // Always mobile on native
    isTablet: false,
    isDesktop: false,
    leftSidebarOpen: false,
    toggleLeftSidebar: () => {},
    closeLeftSidebar: () => {},
    openLeftSidebar: () => {},
  };
};
```

2. Update platform resolution in hook exports

### Phase 4: Update AccentColorSwitcher Component

**Goal**: Update the existing AccentColorSwitcher to use cross-platform dependencies

**Tasks**:

1. **Update component dependencies**:
   - Remove `useAccentColor` import
   - Use `useTheme` from primitives/theme instead
   - Extract accent and setAccent from theme context

2. **Keep platform detection logic** (it's already cross-platform):
   - Continue using `isNative` for platform-appropriate sizing
   - Continue using `useResponsiveLayout` (now cross-platform)
   - Component design is already good

3. **Update component implementation**:

```typescript
import { useTheme } from './primitives/theme';
import { useResponsiveLayout } from '../hooks';

const AccentColorSwitcher: React.FC = () => {
  const { accent, setAccent } = useTheme();  // Use theme context
  const { isMobile } = useResponsiveLayout();

  // Simplified sizing (no platform detection needed)
  const swatchSize = isMobile ? 'medium' : 'large';

  const availableColors = ['blue', 'purple', 'fuchsia', 'orange', 'green', 'yellow'] as const;

  return (
    <FlexRow gap={3}>
      {availableColors.map((color) => (
        <ColorSwatch
          key={color}
          color={color}
          isActive={accent === color}
          onPress={() => setAccent(color)}
          size={swatchSize}
        />
      ))}
    </FlexRow>
  );
};
```

### Phase 5: Mobile Playground Integration

**Goal**: Add AccentColorSwitcher to mobile playground for testing

**Tasks**:

1. **Copy component to playground**:
   - Copy updated AccentColorSwitcher to `src/dev/playground/mobile/components/`
   - Follow existing playground structure

2. **Add a theme color switcher below the current theme switcher (ThemeRadioGroup) in the main Playground page**:

- Dont' add any title, simply add the colors swatches bewlo the 3 radio buttons with icons that are already present in the page

3. **Integration testing**:
   - Verify accent changes affect ColorSwatch components
   - Test with different theme modes (light/dark/system)
   - Confirm other primitive components respond to accent changes

### Phase 6: Persistence Testing & Validation

**Goal**: Comprehensive testing of persistence across platforms

**Test Cases**:

**Theme Persistence**:

- [ ] Web: Theme choice survives browser refresh
- [ ] Web: Theme choice survives browser restart
- [ ] Native: Theme choice survives app backgrounding
- [ ] Native: Theme choice survives app force-close/restart
- [ ] Both: System theme changes are detected and applied

**Accent Persistence**:

- [ ] Web: Accent choice survives browser refresh
- [ ] Web: Accent choice survives browser restart
- [ ] Native: Accent choice survives app backgrounding
- [ ] Native: Accent choice survives app force-close/restart
- [ ] Both: Accent changes propagate to all themed components

**Cross-Platform Consistency**:

- [ ] Same accent colors available on both platforms
- [ ] Same component behavior (sizing, interaction)
- [ ] Same visual appearance across themes
- [ ] Same persistence behavior patterns

**Component Integration**:

- [ ] ColorSwatch responds to accent changes
- [ ] Button components use accent colors correctly
- [ ] Other primitives reflect accent color changes
- [ ] ThemeRadioGroup works alongside AccentColorSwitcher

### Phase 7: Update docs

- If all tests are succesfull, update .readme/docs/features/cross-platform-theming.md adding this new feature we just implemented.

## Technical Requirements

### Dependencies

- `@react-native-async-storage/async-storage` (for native persistence)
- Existing theme system architecture
- Cross-platform primitive components

### Architecture Changes

- Unified theme provider interfaces
- AsyncStorage integration for native
- Removal of standalone useAccentColor hook
- Platform-specific useResponsiveLayout implementations

### File Changes

```
src/components/primitives/theme/
├── ThemeProvider.native.tsx     # Add AsyncStorage persistence
├── ThemeProvider.web.tsx        # Add accent management
└── ThemeProvider.ts             # Update interfaces

src/hooks/
├── useResponsiveLayout.native.ts # New native implementation
└── useResponsiveLayout.ts        # Keep existing web version

src/components/
└── AccentColorSwitcher.tsx       # Update to use theme providers

src/hooks/business/ui/
├── useAccentColor.ts             # DELETE - obsolete
└── index.ts                      # Remove useAccentColor export

src/dev/playground/mobile/
├── components/AccentColorSwitcher.tsx    # Copy from main
└── screens/AccentColorSwitcherTestScreen.tsx # New test screen
```

## Expected Outcomes

### Functionality

- **Full Persistence**: Theme and accent choices survive app restarts on both platforms
- **Cross-Platform**: Single AccentColorSwitcher component works identically everywhere
- **Unified Management**: Theme providers handle all theme/accent logic
- **No Platform Logic**: Components don't need platform detection

### User Experience

- **Consistent**: Same behavior and appearance across web and mobile
- **Reliable**: Settings always persist between sessions
- **Integrated**: Accent changes immediately affect all themed components
- **Intuitive**: Simple, unified accent color selection

### Technical Benefits

- **Simplified Architecture**: Single source of truth for theming
- **Maintainable**: No duplicate logic between platforms
- **Extensible**: Easy to add new accent colors or theme features
- **Testable**: Clear interfaces and predictable behavior

## Priority

**High** - Essential for mobile app feature parity and user experience consistency.

## Dependencies

- Cross-platform theme system (✅ completed)
- ColorSwatch component fixes (✅ completed)
- Primitive components modernization (✅ completed)

---

_Created: 2025-08-04_
_Status: Todo_
_Assigned: TBD_
