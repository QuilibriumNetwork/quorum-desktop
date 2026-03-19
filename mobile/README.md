# Quorum Mobile Development

This is the mobile development environment for testing cross-platform components and building the React Native app.

## Development Environment

The mobile app uses **Expo Dev Client** (not Expo Go) and shares components with the web app through a cross-platform architecture.

For complete environment setup, see: [Expo Dev Testing Guide](../.agents/docs/expo-dev-testing-guide.md)

## Quick Development Workflow

**First-Time Setup:**

```bash
# Install dev client on device/emulator (first time only, ~20-25 min)
cd mobile
node_modules/.bin/expo run:android  # Android (npx has path issues in Yarn workspaces)
node_modules/.bin/expo run:ios      # iOS (macOS only)
```

> **Windows note**: Requires `ANDROID_HOME`, `JAVA_HOME`, and `GRADLE_USER_HOME` environment variables. See [Android Build Workflow](../.agents/docs/development/android-build-workflow.md) for details.

**Daily Development:**

1. Start emulator manually:

   ```bash
   emulator @AVD_NAME     # Android
   open -a Simulator      # iOS
   ```

2. Start development server (from project root):
   ```bash
   yarn mobile            # Standard
   yarn mobile:tunnel     # For WSL/remote development
   ```

## Available Scripts

From the project root:

- `yarn mobile` - Start Expo dev server
- `yarn mobile:tunnel` - Use tunnel for remote/WSL development
- `yarn mobile:android` - Target Android specifically
- `yarn mobile:ios` - Target iOS specifically
- `yarn mobile:clear` - Clear Metro cache and restart
- `yarn mobile:build` - Build Android APK

## Troubleshooting

### Metro bundler issues?

- Run `yarn mobile:clear` to clear cache
- Delete `node_modules` and run `yarn install`

### Build issues?

- Clean Android build: `cd mobile/android && ./gradlew clean`
- Ensure environment variables are set: `ANDROID_HOME`, `JAVA_HOME`, `GRADLE_USER_HOME`
- **Windows accented username**: Use NTFS junctions + `GRADLE_USER_HOME` on an accent-free path (see [Android Build Workflow](../.agents/docs/development/android-build-workflow.md))

### Network issues?

- Use `yarn mobile:tunnel` for remote development
- Ensure devices are on same network (unless using tunnel)

## Architecture

The mobile app uses:

- React Native components (`.native.tsx` files)
- Shared business logic from `src/`
- Native styling (no SCSS)
- Cross-platform primitives

### Dependency Management

This mobile workspace follows **Yarn workspaces best practices**:

- **Shared dependencies** (React, Expo, React Native, business logic libraries) are installed in the **root package.json** and automatically hoisted
- **Mobile package.json** contains only:
  - Mobile-specific build tools (like Babel configs)
  - Dependencies requiring different versions than web
  - True mobile-only packages not used elsewhere

This approach ensures faster installs, prevents version conflicts, and follows 2024 monorepo standards.

## Testing Components

The playground includes test screens for Primtives and Business Components.

---

_Updated: 2026-03-15_
