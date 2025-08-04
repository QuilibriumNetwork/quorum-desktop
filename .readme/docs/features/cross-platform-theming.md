# Cross-Platform Theming System

This document describes our comprehensive cross-platform theming architecture that provides consistent theme switching and color management across web and React Native platforms.

## Overview

Our theming system is built with a shared-first approach, providing:
- **Unified Theme API**: Same interface for web and mobile
- **System Theme Detection**: Automatic light/dark detection on both platforms
- **Shared Component Support**: Single ThemeRadioGroup works everywhere
- **Color Consistency**: Mobile colors mirror web CSS variables exactly

## Architecture

### File Structure

```
src/components/primitives/theme/
├── ThemeProvider.ts               # Shared types/interfaces
├── ThemeProvider.web.tsx          # Web implementation (matchMedia API)
├── ThemeProvider.native.tsx       # React Native (useColorScheme hook)
├── colors.ts                      # Shared color definitions
└── index.ts                       # Platform resolution
```

### Platform Resolution

The system automatically selects the correct provider:
- **Web**: Uses `ThemeProvider.web.tsx` with `window.matchMedia()`
- **React Native**: Uses `ThemeProvider.native.tsx` with `useColorScheme()`

Both platforms export the same API through `src/components/primitives/theme/index.ts`.

## Theme Types

```typescript
export type Theme = 'light' | 'dark' | 'system';
```

### Theme Resolution

| Theme Value | Web Behavior | Mobile Behavior |
|-------------|--------------|-----------------|
| `'light'` | Force light theme | Force light theme |
| `'dark'` | Force dark theme | Force dark theme |
| `'system'` | Uses `matchMedia('(prefers-color-scheme: dark)')` | Uses React Native `useColorScheme()` |

## Theme Provider Interfaces

### Web Interface
```typescript
interface ThemeContextType {
  theme: Theme;                    // Current setting ('light'|'dark'|'system')
  setTheme: (value: Theme) => void;
  resolvedTheme: 'light' | 'dark'; // Actual applied theme
}
```

### Mobile Interface
```typescript
interface PrimitivesThemeContextType extends ThemeContextType {
  accent: AccentColor;             // Additional mobile properties
  setAccent: (value: AccentColor) => void;
  colors: ColorPalette;            // Pre-calculated colors
  getColor: (path: string) => string;
}
```

## Color System

### Color Mirroring

Mobile colors **exactly mirror** web CSS variables:

```scss
// Web CSS (_colors.scss)
--surface-0: #fefeff;
--surface-3: #e6e6eb;
--color-text-main: #363636;
```

```typescript
// Mobile colors.ts
surface: {
  '0': '#fefeff',    // Matches --surface-0
  '3': '#e6e6eb',    // Matches --surface-3
},
text: {
  main: '#363636',   // Matches --color-text-main
}
```

### Mobile-Specific Field Colors

Mobile has additional field-specific colors optimized for React Native:

```typescript
field: {
  bg: '#e6e6eb',           // Input background (surface-3)
  border: '#cdccd3',       // Input border (surface-6)
  borderFocus: '#0287f2',  // Focus state (accent)
  text: '#363636',         // Input text
  placeholder: '#818181',  // Placeholder text
}
```

## Usage Patterns

### Shared Components

Components can be truly cross-platform:

```typescript
// ThemeRadioGroup.tsx - Works on both platforms
import { useTheme, type Theme } from './primitives/theme';

const ThemeRadioGroup = () => {
  const { theme, setTheme } = useTheme();
  
  return (
    <RadioGroup
      options={[
        { value: 'light', label: t`Light`, icon: 'sun' },
        { value: 'dark', label: t`Dark`, icon: 'moon' },
        { value: 'system', label: t`System`, icon: 'desktop' },
      ]}
      value={theme}
      onChange={setTheme}
    />
  );
};
```

### Platform-Specific Usage

**Web:**
```typescript
// Automatic CSS class application
// theme='system' + user prefers dark → html.dark class applied
```

**React Native:**
```typescript
// Pre-calculated colors available
const theme = useTheme();
const backgroundColor = theme.colors.bg.app;
```

## System Theme Detection

### Web Implementation
```typescript
// Uses matchMedia API
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listens for changes
mediaQuery.addEventListener('change', onSystemChange);
```

### Mobile Implementation
```typescript
// Uses React Native hook
const systemColorScheme = useColorScheme(); // 'light' | 'dark' | null

// Automatic re-render on system changes
useEffect(() => {
  const actualTheme = theme === 'system' 
    ? (systemColorScheme === 'dark' ? 'dark' : 'light')
    : theme;
  setResolvedTheme(actualTheme);
}, [theme, systemColorScheme]);
```

## Development Guidelines

### Adding New Colors

1. **Add to web CSS first** (`_colors.scss`)
2. **Mirror exactly in mobile** (`colors.ts`)
3. **Update both light and dark themes**
4. **Test on both platforms**

### Theme Provider Updates

When updating theme providers:
1. **Maintain interface compatibility** between web and native
2. **Update shared types** in `ThemeProvider.ts`
3. **Test ThemeRadioGroup** on both platforms
4. **Verify system theme detection**

### Component Best Practices

**✅ Do:**
```typescript
// Use pre-resolved colors from provider
const theme = useTheme();
const colors = theme.colors; // Already resolved

// Use semantic color names
backgroundColor: colors.bg.app
color: colors.text.main
```

**❌ Don't:**
```typescript
// Don't resolve themes in components
const actualTheme = theme.theme === 'system' ? 'light' : theme.theme;
const colors = getColors(actualTheme); // Provider already did this

// Don't use hardcoded values
backgroundColor: '#ffffff' // Use colors.bg.app instead
```

### Avoiding Conflicts

1. **Never modify colors.ts without updating CSS** - They must stay in sync
2. **Don't resolve 'system' theme in components** - Let providers handle it
3. **Use theme.colors, not getColors()** - Colors are pre-calculated  
4. **Test both platforms** when making theme changes
5. **Keep platform providers in sync** - Same API, different implementation

## Testing

### Manual Testing Checklist

**Both Platforms:**
- [ ] Light theme renders correctly
- [ ] Dark theme renders correctly  
- [ ] System theme matches OS preference
- [ ] Theme switching is immediate
- [ ] System changes are detected automatically

**Mobile Specific:**
- [ ] Field colors have proper contrast
- [ ] Touch targets work in all themes
- [ ] StatusBar adapts to theme

**Web Specific:**
- [ ] CSS classes applied correctly
- [ ] LocalStorage persistence works
- [ ] Media query changes detected

## Troubleshooting

### Common Issues

**"Cannot read property 'border' of undefined"**
- Component is calling `getColors()` with 'system' theme
- Solution: Use `theme.colors` instead of resolving manually

**Colors don't match between platforms**
- CSS variables and colors.ts are out of sync
- Solution: Compare and update both files to match

**System theme not working**
- Check platform-specific detection is working
- Web: Verify `matchMedia` support
- Mobile: Verify `useColorScheme` import

**Theme switching not working**
- Components using different ThemeProvider contexts
- Solution: Ensure all imports use `./primitives/theme`

---

*Updated: 2025-08-04*