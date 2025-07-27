# Playground Directory

This directory contains testing environments for validating cross-platform primitives and UI components during development.

## Directory Structure

```
src/playground/
├── web/                      # Web playground for testing primitives in browser
│   └── PrimitivesPlayground.tsx  # Web playground component
└── mobile/                   # Mobile playground for React Native testing
    └── quorum-mobile-test/   # React Native test environment
```

## Build Configuration

### Development Mode
```bash
yarn dev
```
- Playground is **always included** and available at `/playground` route
- No configuration needed

### Production Build
```bash
# Default: playground excluded (reduces bundle size)
yarn build

# Include playground in production (for testing/demos)
yarn build --playground
```

### Build Impact
- **Default build**: 696 modules (playground excluded)
- **With playground**: 742 modules (~75KB additional JavaScript)
- **Mobile playground**: Always excluded from all builds

## Web Playground

### Accessing the Web Playground

During development, navigate to:
- **URL**: `/playground`
- **Example**: `http://localhost:5173/playground`

### What's Available

The web playground includes:

#### 1. Theme Testing
- Dark/Light mode switching
- Accent color selection
- Visual validation of theme changes

#### 2. Primitive Components
- **Layout**: FlexRow, FlexBetween, FlexCenter
- **Containers**: ModalContainer, OverlayBackdrop, ResponsiveContainer
- **Controls**: Button, Switch, RadioGroup, Select
- **Inputs**: Input, TextArea
- **Display**: Icon, ColorSwatch, Tooltip
- More primitives added as they're developed

#### 3. Interactive Testing
- Test different prop combinations
- Verify animations and transitions
- Check responsive behavior
- Validate keyboard navigation

### Testing Checklist

When testing primitives:
- [ ] Visual appearance matches design
- [ ] Animations are smooth
- [ ] Click interactions work correctly
- [ ] Keyboard navigation (Tab, Escape) works
- [ ] No console errors
- [ ] No layout shifts or flickers
- [ ] Dark/light theme both work
- [ ] Z-index layering is correct
- [ ] Responsive behavior at different screen sizes

## Mobile Testing

### Mobile Test Environment

**Path**: `src/playground/mobile/quorum-mobile-test/`  
**Tool**: Expo Go app with tunnel mode  
**Status**: Fully functional for primitive testing

### Prerequisites

1. **Expo Go App**: Download from [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) (Android) or [App Store](https://apps.apple.com/app/expo-go/id982107779) (iOS)
2. **Same WiFi Network**: Your device and development machine should be on the same network

### Starting Mobile Testing

1. **Navigate to mobile test directory**:
   ```bash
   cd src/playground/mobile/quorum-mobile-test
   ```

2. **Start with tunnel mode** (required for WSL2):
   ```bash
   yarn start --tunnel
   ```

3. **Connect your device**:
   - **Option A**: Scan the QR code with Expo Go app
   - **Option B**: Enter the tunnel URL manually (e.g., `exp://xyz-abc.tunnel.exp.direct:80`)

### Testing on Different Platforms

#### Web Browser (Quick Development)
- Access `http://localhost:8081` in your browser
- Shows React Native components via react-native-web
- Good for rapid iteration and layout checks (not recommended for definitive testing)

#### Android Testing (Primary Mobile Platform)
- Use Expo Go app with tunnel URL
- Tests actual React Native implementations (`.native.tsx` files)
- Validates touch interactions, performance, and native behaviors

#### iPhone Testing (Secondary Platform)
- Same process as Android - use Expo Go app
- Important for iOS-specific behaviors and gestures
- Essential before production releases

### Mobile-Specific Features to Test

- **Touch Interactions**: Native tap, swipe, and gesture responses
- **SafeAreaView**: Proper content positioning around notches/status bars
- **Performance**: 60fps animations and smooth scrolling
- **Platform Differences**: iOS vs Android specific behaviors
- **Screen Sizes**: Various device dimensions and orientations

## Development Workflow

### Recommended Process

1. **Build Primitive** in `src/components/primitives/`
2. **Test on Desktop** using `/playground` route
3. **Copy to Mobile Environment** if needed for mobile-specific testing
4. **Test on Mobile** using Expo Go app
5. **Fix Issues** in both environments
6. **Commit** when both platforms work correctly

### Adding New Primitives to Playground

1. Import the primitive in `PrimitivesPlayground.tsx`
2. Add a new section with examples
3. Include different prop combinations
4. Test both controlled and uncontrolled states
5. Document any platform-specific behaviors

## Troubleshooting

### Common Issues

**Problem**: Playground route not found  
**Solution**: Ensure you're running in development mode (`yarn dev`)

**Problem**: Android Expo Go shows loading but nothing appears  
**Solution**: Use tunnel mode (`yarn start --tunnel`) instead of LAN mode

**Problem**: QR code scan fails  
**Solution**: Enter tunnel URL manually in Expo Go app

**Problem**: `ERR_CONNECTION_REFUSED` on localhost  
**Solution**: WSL2 networking issue - use tunnel mode for mobile testing

### WSL2 Specific Notes

- Always use `--tunnel` flag for mobile testing from WSL2
- Localhost URLs won't work from Windows host to WSL2
- Tunnel mode creates a public URL that bypasses networking issues

## Quick Development Tips

- Keep playground open in a separate browser tab during development
- Use browser DevTools to inspect rendered HTML and styles
- Test keyboard-only navigation for accessibility
- Check responsive behavior by resizing the window
- Use React Developer Tools for component inspection
- Test with screen readers for accessibility compliance

## Platform Testing Strategy

### During Development (Phases 1-2)
- Focus on web playground for rapid iteration
- Android testing for mobile validation
- iPhone testing optional

### Before Major Milestones (Phases 3-4)
- Test all primitives on web
- Validate on Android device
- Include iPhone testing for platform-specific issues

### Production Ready (Phases 5-6)
- Full testing on all platforms
- Performance profiling
- Accessibility validation
- Cross-browser testing

## Component Synchronization

### Sync Status Checking

To check if playground components are in sync with main app components:

```bash
# Check sync status of all components
yarn playground:check
```

This will show you:
- Which components are in sync vs out of sync
- Which version is newer (main app or playground)
- File sizes and modification dates
- Detailed file-by-file comparison

### Syncing Components

The playground contains copies of components for testing. Use these commands to keep them synchronized:

```bash
# Copy from main app to playground (most common)
yarn playground:sync --to-playground Button Switch

# Copy from playground to main app (after testing changes)
yarn playground:sync --from-playground Button

# Sync newer files automatically (recommended for mixed scenarios)
yarn playground:sync --sync-newer --all

# Interactive mode - choose direction for each component
yarn playground:sync --interactive

# Sync all components
yarn playground:sync --to-playground --all

# Dry run to see what would change
yarn playground:sync --dry-run --sync-newer --all

# Sync without creating backups (faster, but no safety net)
yarn playground:sync --to-playground Button --no-backup
```

### Sync Safety Features

- **Smart backups**: Creates timestamped `.backup-YYYY-MM-DD` files before overwriting
- **Auto cleanup**: Keeps only the 3 most recent backups per file
- **Uncommitted changes warning**: Warns if you have uncommitted Git changes
- **Import path adjustment**: Automatically fixes import paths between environments
- **File-by-file control**: Skip specific files with interactive mode
- **Backup management**: `--no-backup` flag to disable backups entirely

### Backup Management

```bash
# View all backup files
yarn playground:cleanup

# Delete backups older than 7 days
yarn playground:cleanup --older 7

# Delete all backup files
yarn playground:cleanup --all

# See what would be deleted without actually deleting
yarn playground:cleanup --dry-run --all
```

### When to Sync

**To Playground** (main app → playground):
- After updating components in main app
- Before testing new component features
- When playground components are outdated

**From Playground** (playground → main app):
- After testing and perfecting components in playground
- When playground has newer/better implementations
- After mobile-specific optimizations

## Frequently Asked Questions

**Q: Why is playground excluded from production by default?**  
A: To reduce bundle size and keep production builds clean. Use `--playground` flag if needed.

**Q: Do I need to manually sync components?**  
A: Yes, for safety. Use `yarn playground:check` to see status and `yarn playground:sync` when needed.

**Q: What if I accidentally overwrite a newer component?**  
A: Each sync creates timestamped `.backup-YYYY-MM-DD` files. You can restore from the most recent backup or use `yarn playground:cleanup` to manage them.

**Q: Should I use --sync-newer for mixed scenarios?**  
A: Yes! `--sync-newer` automatically copies each file from whichever location is newer, perfect when some main app components are newer and some playground components are newer.

**Q: Do I need a Mac for iOS testing?**  
A: No! Expo Go works on any iPhone. Only iOS Simulator requires a Mac.

**Q: Can I test mobile primitives without a physical device?**  
A: Yes, use `http://localhost:8081` for web-based mobile preview, but physical device testing is recommended.

**Q: Why use separate .web.tsx and .native.tsx files?**  
A: Platform-specific optimizations and behaviors. Web uses CSS, mobile uses StyleSheet.

**Q: How do I share mobile testing with team members?**  
A: Share the tunnel URL from Expo. They need Expo Go app installed.

---

_Last updated: 2025-07-27 13:30 UTC_