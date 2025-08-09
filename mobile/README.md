# Quorum Mobile Playground

This is the mobile development playground for testing cross-platform primitive components.

## Setup

1. **Install Expo Go on your phone**
   - Android: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Start the development server**
   ```bash
   yarn mobile
   ```

3. **Connect your phone**
   - Make sure your phone and computer are on the same network
   - Scan the QR code shown in the terminal with:
     - Android: Expo Go app
     - iOS: Camera app (will open in Expo Go)

## Available Scripts

From the project root:

- `yarn mobile` - Start Expo dev server (recommended)
- `yarn mobile:tunnel` - Use if phone/computer on different networks
- `yarn mobile:android` - Open in Android emulator
- `yarn mobile:ios` - Open in iOS simulator
- `yarn mobile:clear` - Clear cache and restart

## Troubleshooting

### Can't connect to dev server?
- Use `yarn mobile:tunnel` for remote development
- Check firewall settings
- Ensure both devices on same WiFi

### Metro bundler issues?
- Run `yarn mobile:clear` to clear cache
- Delete `node_modules` and run `yarn install`

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
*Updated: 2025-08-09*