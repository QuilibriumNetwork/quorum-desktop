---
type: task
title: React Native Upgrade Risk Assessment
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# React Native Upgrade Risk Assessment

## Overview

This document assesses the risks of upgrading from React Native 0.79.5 to 0.80.2 for the Quorum cross-platform application.

## Current Environment

- **React Native**: 0.79.5
- **Expo SDK**: 53.0.20
- **React Native Reanimated**: 3.17.4
- **React Native Gesture Handler**: 2.24.0

## Risk Analysis

### 🚨 HIGH RISK - Expo SDK Incompatibility

**Critical Finding**: Expo SDK 53 was specifically built for React Native 0.79, not 0.80.

- **Current Setup**: Expo SDK 53.0.20 + React Native 0.79 ✅
- **Target Setup**: Expo SDK 53.0.20 + React Native 0.80.2 ❌
- **Impact**: Known issues with bare workflow installations failing
- **Root Cause**: Version mismatch between Expo SDK expectations and React Native version

### ⚠️ MEDIUM RISK - New Architecture Conflicts

**Configuration Inconsistency Detected**:

- Project enables New Architecture (`"newArchEnabled": true`)
- Uses Reanimated 3.17.4 (old architecture library)
- Potential conflicts when upgrading to Reanimated 4.x

**Risk**: Existing animations might break with forced New Architecture migration.

### 🔧 LOW RISK - Existing Animation Dependencies

**Current Animation Usage Analysis**:
All existing animations use stable React Native Animated API:

- `Switch.native.tsx`: Uses `Animated.timing` ✅
- `Modal.native.tsx`: Uses `Animated.parallel + Animated.timing` ✅
- `ModalContainer.native.tsx`: Uses standard React Native Animated API ✅

**Assessment**: These implementations are version-stable and should survive upgrades.

## Breaking Changes Impact Assessment

### 1. Deep Imports Deprecation

**Risk Level**: LOW

- Audit Result: No problematic deep imports found in codebase
- Pattern Search: `grep -r "react-native/Libraries" src/` returned no matches

### 2. TypeScript API Changes

**Risk Level**: MEDIUM

- Modal component contains `@ts-ignore` workarounds
- Some `any` type usage that may break with stricter TypeScript enforcement
- Potential for new type errors requiring code fixes

### 3. Package.json Exports Field

**Risk Level**: HIGH

- Metro bundler changes in RN 0.80 affect module resolution
- Expo SDK 53 + RN 0.80 = Known compatibility matrix issues
- Could break existing import/export patterns

## Component Risk Assessment

### ✅ SAFE Components (44 total)

- All Flex layout components (FlexRow, FlexColumn, FlexCenter, FlexBetween)
- Core UI primitives (Text, Input, Button, Icon)
- Layout containers (Container, ResponsiveContainer)
- Theme system components
- Form components (Select, TextArea, Switch)

### ⚠️ AT-RISK Components (3 total)

- **Modal.native.tsx**: Uses deprecated gesture handling patterns
- **ModalContainer.native.tsx**: Similar animation implementation
- **Switch.native.tsx**: Uses standard Animated API (likely safe but needs testing)

## Critical Finding: Missing Configuration

**Root Cause Identified**: The gesture handling issues stem from missing Babel configuration, not version incompatibility.

**Missing Configuration**:

```javascript
// mobile/babel.config.js - CURRENTLY MISSING
plugins: [
  '@lingui/babel-plugin-lingui-macro',
  'react-native-reanimated/plugin', // ← ADD THIS (must be last!)
];
```

## Dependency Chain Risks

### Expo SDK Compatibility Matrix

- Expo SDK 53 supports React Native 0.79.x only
- No official support for React Native 0.80+ in current SDK version
- Breaking changes in Metro bundler could affect Expo's module resolution

### React Native Reanimated Version Conflicts

- Current: Reanimated 3.17.4 (old architecture)
- React Native 0.80 pushes toward New Architecture adoption
- Potential forced migration to Reanimated 4.x with breaking API changes

### Gesture Handler Dependencies

- Current version stable with React Native 0.79
- Unknown compatibility with React Native 0.80 gesture system changes
- Risk of breaking touch interactions in Modal components

## Overall Risk Assessment

**OVERALL RISK LEVEL**: 🚨 **HIGH**

The combination of Expo SDK incompatibility, New Architecture conflicts, and Metro bundler changes creates a high-risk upgrade scenario. The stable functionality of 44 primitive components could be compromised by dependency chain failures, particularly in the Expo + React Native version compatibility matrix.

**Key Risk Factors**:

1. Expo SDK 53 + React Native 0.80 = Unsupported configuration
2. Missing Babel configuration amplifies compatibility issues
3. Metro bundler changes may break existing module resolution patterns
4. Potential cascade failures across gesture handling and animation systems
