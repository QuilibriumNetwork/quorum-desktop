# Primitives Testing Guide

## Accessing the Primitives Playground

During development, you can test all primitives by navigating to:

**URL**: `/primitives`

Example: If running locally on port 5173, visit:

```
http://localhost:5173/primitives
```

## What You'll Find

The Primitives Playground includes:

### 1. ModalContainer Testing

- Modal with backdrop (click outside or ESC to close)
- Modal without backdrop (ESC only)
- Tests animation states
- Verifies z-index layering

### 2. OverlayBackdrop Testing

- Standalone backdrop with content
- Click-outside functionality
- Blur effect verification

### 3. Future Primitives (Placeholders)

- FlexRow, FlexBetween, FlexCenter
- ResponsiveContainer
- Button primitive
- More to come...

## Testing Checklist

When testing each primitive:

- [ ] Visual appearance matches design
- [ ] Animations are smooth
- [ ] Click interactions work correctly
- [ ] Keyboard navigation (Tab, Escape) works
- [ ] No console errors
- [ ] No layout shifts or flickers
- [ ] Dark/light theme both work
- [ ] Z-index layering is correct

## Adding New Primitives to Playground

When you create a new primitive:

1. Import it in `PrimitivesPlayground.tsx`
2. Add a new section with examples
3. Include different prop combinations
4. Test both controlled and uncontrolled states

## Quick Development Tips

- Keep the playground open in a separate browser tab
- Use browser DevTools to inspect rendered HTML
- Check responsive behavior by resizing window
- Test with keyboard-only navigation

---

---

# Mobile Testing Workflow - Complete Beginner's Guide

## Overview

This guide explains how to test the primitives we're building for both web (desktop) and React Native (mobile), even if you've never done mobile development before.

## Part 1: Testing on Desktop (What You're Doing Now)

### Current Setup

- **Where**: Your browser at `http://localhost:5173/primitives`
- **What**: Testing that primitives work correctly on desktop
- **Why**: Ensure no regressions in existing desktop functionality

### Desktop Testing Checklist

1. ✅ Visual appearance matches current app style
2. ✅ Animations are smooth
3. ✅ Click interactions work
4. ✅ Keyboard navigation (Tab, Escape)
5. ✅ Dark/light theme switching
6. ✅ Different window sizes

## Part 2: Mobile Testing Workflow (IMPLEMENTED ✅)

### ✅ Mobile Testing is Now Available!

We successfully implemented mobile testing during **Phase 1D**. Our primitives now work on both desktop and mobile!

**Current Status**:

- `.web.tsx` - Desktop versions (what you see on web)
- `.native.tsx` - Mobile versions (working on React Native)
- **Cross-platform architecture proven** ✅

### Mobile Test Environment Location

**Path**: `src/playground/mobile/quorum-mobile-test/`  
**Tool**: Expo Go app with tunnel mode  
**Status**: Fully functional for primitive testing

## Part 3: How to Test Mobile (Actual Working Process)

### Prerequisites ✅ Already Installed

1. **Expo Go App**: Download from Google Play Store (Android) or App Store (iOS)
2. **ngrok**: Installed in mobile test environment for tunnel connectivity
3. **Same WiFi Network**: Your device and development machine

### Step-by-Step Mobile Testing

#### 1. Start the Mobile Test Environment

```bash
cd src/playground/mobile/quorum-mobile-test
yarn start --tunnel
```

**Important**: Use `--tunnel` flag for WSL2 compatibility!

#### 2. Connect Your Mobile Device

**Option A - QR Code (Preferred)**:

1. QR code appears in terminal after `yarn start --tunnel`
2. Open Expo Go app on your device
3. Scan QR code with Expo Go camera

**Option B - Manual URL Entry**:

1. Look for tunnel URL in terminal: `exp://xyz-abc.tunnel.exp.direct:80`
2. Open Expo Go app → "Enter URL manually"
3. Type the exact tunnel URL

#### 3. Test Both Platforms

**Web Testing (Quick Development)**:

- Access `http://localhost:8081` in browser
- Shows React Native components via react-native-web
- Good for rapid iteration and layout checks

**Mobile Testing (Full Validation)**:

- Use Expo Go app with tunnel URL
- Tests actual React Native implementations (.native.tsx files)
- Essential for touch interactions, performance, native behaviors

### Android vs iPhone Testing

#### Android Testing (Primary Platform)

**Setup**: Expo Go app from Google Play Store  
**Access**: Same tunnel URL process as described above  
**Testing Coverage**: 90% of mobile validation needs

**What Android testing validates**:

- ✅ Cross-platform primitive architecture
- ✅ React Native performance and rendering
- ✅ Touch interactions and gestures
- ✅ SafeAreaView behavior (for notches/status bars)
- ✅ Layout responsiveness across screen sizes
- ✅ Native animations and transitions

#### iPhone Testing (Secondary Platform)

**Setup**: Expo Go app from iOS App Store (free)  
**Access**: Identical process - scan same QR code or enter same tunnel URL  
**Testing Coverage**: Platform-specific iOS behaviors

**What iPhone testing adds**:

- 🍎 iOS-specific touch handling and gestures
- 🍎 iPhone notch/Dynamic Island SafeAreaView differences
- 🍎 iOS navigation patterns and back gestures
- 🍎 iOS-specific performance characteristics
- 🍎 iOS accessibility features (VoiceOver)

#### Testing Strategy by Development Phase

**Phase 1-2 (Primitive Development)**:

- **Android testing sufficient** for validating core architecture
- **iPhone testing optional** - primitives work identically on both platforms

**Phase 3-4 (Advanced Features)**:

- **Android testing required** for continued development
- **iPhone testing recommended** for platform-specific behaviors

**Phase 5-6 (Production Ready)**:

- **Both platforms required** for app store submission
- **iPhone testing essential** for iOS-specific polish

#### How to Involve iPhone Users in Testing

**For iPhone testers who want to help**:

1. **Install Expo Go**: Download "Expo Go" app from iOS App Store
2. **Get the tunnel URL**: Ask developer for current tunnel URL (like `exp://xyz-abc.tunnel.exp.direct:80`)
3. **Connect**: Open Expo Go → "Enter URL manually" → paste tunnel URL
4. **Test**: Same primitives testing as Android, but note iOS-specific behaviors

**What to ask iPhone testers to check**:

- Does the app load and display correctly?
- Do touch interactions feel natural and responsive?
- Are there any layout issues specific to iPhone screen sizes?
- Do gestures work as expected (swipe, pinch, etc.)?
- Any performance issues or frame drops?

**When to involve iPhone testers**:

- After major primitive additions
- Before important milestones
- When testing advanced gestures or navigation
- Before production releases

#### Testing Parity

**Important**: Both Android and iPhone run **identical React Native code** (.native.tsx files). The differences are in:

- Platform-specific styling nuances
- Touch feedback timing
- Native gesture recognition
- SafeAreaView implementation details

**Core primitive functionality is identical** across platforms.

### What You'll See on Mobile

Our current mobile test app shows:

- 🚀 **Mobile Primitives Test** title
- **Flex Layout Test**: FlexRow primitive with 3 items
- **Space Between Test**: FlexBetween primitive
- **Center Test**: FlexCenter primitive
- **Success message** confirming architecture works

### Mobile-Specific Features We Test

✅ **Touch Interactions**: Native tap responses  
✅ **SafeAreaView**: Proper content positioning around notches  
✅ **React Native Styling**: StyleSheet instead of CSS  
✅ **Performance**: 60fps native animations  
✅ **Platform Resolution**: Correct .native.tsx file usage

## Part 4: Current Testing Workflow (Updated)

### Dual-Platform Testing Available

✅ **Desktop Testing**: `http://localhost:5173/primitives` (main app)  
✅ **Mobile Testing**: `src/playground/mobile/quorum-mobile-test/` (Expo environment)

### Recommended Development Cycle

1. **Build Primitive** in main app (`src/components/primitives/`)
2. **Test on Desktop** using `/primitives` playground
3. **Copy to Mobile Environment** for mobile testing
4. **Test on Mobile** using Expo Go app
5. **Fix Issues** in both environments
6. **Commit** when both platforms work

### Quick vs Full Testing

**🚀 Quick Development (Web)**:

- Use `http://localhost:8081` (mobile test environment web view)
- Rapid iteration for layout and basic functionality
- React Native components rendered via react-native-web

**📱 Full Validation (Mobile)**:

- Use Expo Go app with tunnel URL
- Essential for touch interactions and native behaviors
- Tests actual React Native (.native.tsx) implementations

### How to Report Issues

**Desktop Issues**:

- Test in main app primitives playground
- Note browser console errors
- Check responsive behavior

**Mobile Issues**:

- Test in Expo Go app
- Note touch interaction problems
- Check performance and animations
- Test on multiple device sizes

## Part 5: Troubleshooting Mobile Testing

### Common Issues & Solutions

**Problem**: Android Expo Go shows loading but nothing appears  
**Solution**: Use tunnel mode (`yarn start --tunnel`) instead of LAN mode

**Problem**: QR code scan fails  
**Solution**: Manual URL entry with tunnel URL from terminal

**Problem**: `ERR_CONNECTION_REFUSED` on localhost  
**Solution**: WSL2 networking issue - use tunnel mode, not localhost

**Problem**: Web shows different content than mobile  
**Expected**: Web uses `.web.tsx` files, mobile uses `.native.tsx` files

### WSL2 Specific Fixes

**Issue**: Localhost not accessible from Windows  
**Root Cause**: WSL2 networking isolation  
**Solution**: Always use `--tunnel` flag for mobile testing

### Dependency Issues

**Problem**: React Native bundling errors  
**Solution**: Use Expo-compatible versions:

```bash
npx expo install react-dom@19.0.0 react-native-gesture-handler@~2.24.0
```

## Part 6: Testing Strategy Summary

### Current Capabilities (Phase 1D Complete)

✅ **Cross-platform Architecture Proven**  
✅ **Basic Primitives Working**: FlexRow, FlexBetween, FlexCenter  
✅ **Mobile Test Environment Functional**  
✅ **Tunnel Mode for WSL2 Compatibility**

### Testing Workflow

```
Desktop Development → Quick Web Check → Mobile Validation → Commit
```

### Next Phase Goals

- Add more primitives to mobile test environment
- Test Button primitive (without FontAwesome for mobile)
- Test Modal primitive with mobile drawer behavior
- Validate theme system across platforms

## Common Questions

**Q: Do I need a Mac for iOS testing?**
A: No! Expo Go app works on any computer. iOS Simulator requires Mac, but Expo Go on real iPhone works from Windows/Linux.

**Q: Is the mobile app separate from desktop?**
A: No! Same codebase, same primitives, just different implementations (`.web.tsx` vs `.native.tsx`).

**Q: Why use tunnel mode instead of LAN?**
A: WSL2 networking doesn't allow Windows host to access Linux localhost. Tunnel mode creates a public URL that bypasses this.

**Q: Can I test mobile primitives on web?**
A: Yes for quick checks! `http://localhost:8081` shows React Native components via react-native-web. But mobile device testing is essential for touch interactions and performance.

**Q: Do I need both Android and iPhone for testing?**
A: **Android testing covers 90% of validation needs** during primitive development. iPhone testing becomes important for platform-specific behaviors and final production polish.

**Q: How do I get iPhone users to test the app?**
A: Share the tunnel URL (`exp://xyz-abc.tunnel.exp.direct:80`) with iPhone users. They install free "Expo Go" app, enter the URL manually, and test the same primitives.

**Q: Is iPhone testing the same as Android testing?**
A: **Core functionality is identical** - same React Native code runs on both. iPhone testing catches iOS-specific touch behaviors, gesture differences, and SafeAreaView nuances.

**Q: What if I break something?**
A: Git commits after each phase provide restore points. Mobile test environment is isolated from main app.

**Q: Which primitives work on mobile now?**
A: FlexRow, FlexBetween, FlexCenter are proven working. Button and Modal need mobile-specific versions (no FontAwesome dependency).

## Next Steps

1. ✅ **Mobile Testing Works**: Use Expo Go with tunnel mode
2. **Expand Mobile Testing**: Add more primitives to mobile test environment
3. **Cross-Platform Validation**: Test each new primitive on both platforms
4. **Performance Optimization**: Monitor mobile performance as we add complexity

## Development Tips

### For Quick Iteration

1. **Develop on Desktop**: Use main app `/primitives` playground
2. **Quick Check on Web**: Use `http://localhost:8081` mobile test web view
3. **Mobile Validation**: Test on device every few changes
4. **Commit When Both Work**: Ensure cross-platform consistency

### For Mobile-Specific Features

- **SafeAreaView integration**: Test with real device notches
- **Touch target sizes**: Ensure 44pt minimum for accessibility
- **Performance monitoring**: Watch for frame drops on older devices
- **Platform-specific behaviors**: Android back button, iOS gestures

### For iPhone Testing Collaboration

1. **Share tunnel URL**: Send `exp://xyz-abc.tunnel.exp.direct:80` to iPhone user
2. **Simple instructions**: "Install Expo Go app, enter URL manually"
3. **Test same features**: iPhone users test identical primitive functionality
4. **Focus on differences**: Note iOS-specific behaviors vs Android

---

_Last updated: 2025-07-25 (Phase 1D mobile testing implementation)_
