# Implementation Plan: Repository Restructure for Cross-Platform Development

[← Back to INDEX](../../../../INDEX.md) | [📖 Architecture Overview](./web-and-native-repo-structure.md)

This document provides a detailed step-by-step implementation plan to restructure the repository for cross-platform development while maintaining current developer workflows.

## **Objectives**

- Enable parallel web and mobile development
- Maintain current web development workflow (zero disruption for other developers)
- Clean separation of platform-specific code
- Preserve existing functionality and development tools

## **Implementation Phases**

### **Phase 1: Platform Structure Setup**

#### 1.1 Create Platform Directories
- [ ] Create `web/` directory in project root for web-specific files
- [ ] Create `mobile/` directory in project root for future mobile app
- [ ] Create `web/public/` directory for web-specific assets

#### 1.2 Move Web Entry Points
- [ ] Move `index.html` → `web/index.html`
- [ ] Update `index.html` script path: `/src/main.jsx` → `/web/main.tsx`
- [ ] Move `src/main.jsx` → `web/main.tsx` 
- [ ] Convert JSX to TSX format in `web/main.tsx`
- [ ] Update import paths in `web/main.tsx` to use `../src/` prefix

#### 1.3 Move Electron Files
- [ ] Move `electron/` → `web/electron/`
- [ ] Update `package.json` main field: `"main": "web/electron/main.cjs"`
- [ ] Update electron scripts to point to new location

#### 1.4 Move Web-Specific Assets
- [ ] Copy relevant assets from `public/` → `web/public/`
- [ ] Assets to copy: favicon files, robots.txt, handleredirect.js
- [ ] Keep shared assets (WASM, fonts, images) in root `public/` for now

### **Phase 2: Build Configuration Updates**

#### 2.1 Create Web Vite Config
- [ ] Create `web/vite.config.ts`
- [ ] Copy current `vite.config.js` content to new TypeScript config
- [ ] Update root path to point to `../` (project root)
- [ ] Update build output directory
- [ ] Update import paths to reference correct asset locations

#### 2.2 Update Package Scripts
- [ ] Update `dev` script: `"vite --config web/vite.config.ts"`
- [ ] Update `build` script: `"vite build --config web/vite.config.ts"`
- [ ] Update `preview` script: `"vite preview --config web/vite.config.ts"`
- [ ] Update `electron:dev` script to use new electron path
- [ ] Update `electron:build` script to use new electron path

#### 2.3 Update Build Configuration Files
- [ ] Update `electron-builder.json` to reference new file locations
- [ ] Update any references to old file paths in config files
- [ ] Update `.gitignore` if needed for new structure

### **Phase 3: Platform Abstraction Layer**

#### 3.1 Create Platform Utilities
- [ ] Create `src/utils/platform.ts` file
- [ ] Add `isWeb()`, `isMobile()`, `isElectron()` functions
- [ ] Add platform detection logic for runtime decisions

#### 3.2 Create Router Abstraction
- [ ] Create `src/components/Router/` directory
- [ ] Create `src/components/Router/Router.web.tsx` (current routing logic)
- [ ] Create `src/components/Router/Router.native.tsx` (placeholder for mobile)
- [ ] Create `src/components/Router/index.ts` with platform-aware exports
- [ ] Extract current routing from `App.tsx` to `Router.web.tsx`

#### 3.3 Update App.tsx for Platform Awareness
- [ ] Import platform utilities in `src/App.tsx`
- [ ] Replace hardcoded electron checks with `isElectron()` function
- [ ] Import Router from new abstraction layer
- [ ] Test that web app still works identically

### **Phase 4: Mobile Platform Placeholder**

#### 4.1 Create Mobile Structure
- [ ] Create `mobile/App.tsx` (React Native entry point)
- [ ] Create `mobile/app.json` (Expo configuration)
- [ ] Create `mobile/metro.config.js` (Metro bundler config)
- [ ] Create `mobile/babel.config.js` (Babel configuration)
- [ ] Create `mobile/package.json` (mobile-specific dependencies)

#### 4.2 Create Mobile Assets
- [ ] Create `mobile/assets/` directory
- [ ] Add placeholder app icons (1024x1024 PNG)
- [ ] Add splash screen assets
- [ ] Add adaptive icon for Android

#### 4.3 Add Mobile Scripts (Inactive)
- [ ] Add `mobile:dev` script: `"cd mobile && expo start"`
- [ ] Add `mobile:android` script: `"cd mobile && expo start --android"`
- [ ] Add `mobile:ios` script: `"cd mobile && expo start --ios"`
- [ ] Mark these as "Future: Mobile development" in README

### **Phase 5: Testing & Validation**

#### 5.1 Web Development Testing
- [ ] Test `yarn dev` - should work identically to before
- [ ] Test `yarn build` - should produce identical output
- [ ] Test `yarn electron:dev` - should open Electron app normally
- [ ] Test `yarn electron:build` - should build desktop app
- [ ] Test hot reloading works correctly
- [ ] Test all existing routes and functionality

#### 5.2 Development Tools Testing
- [ ] Test `yarn playground:web` still works
- [ ] Test `yarn playground:mobile` still works (existing playground)
- [ ] Test `yarn playground:sync` still works
- [ ] Test primitive component development workflow

#### 5.3 Build & Production Testing
- [ ] Test production build works
- [ ] Test all assets load correctly
- [ ] Test Electron packaging works
- [ ] Test that dev folder is still excluded from production

### **Phase 6: Documentation & Cleanup**

#### 6.1 Update Documentation
- [ ] Update main `README.md` with new structure explanation
- [ ] Update `CLAUDE.md` with new entry point information
- [ ] Create migration guide for other developers
- [ ] Document new platform abstraction patterns

#### 6.2 Team Communication
- [ ] Create announcement for team about structure changes
- [ ] Document what stays the same (web development workflow)
- [ ] Document what's new (mobile capabilities when ready)
- [ ] Provide troubleshooting guide for any issues

#### 6.3 Optional Cleanup
- [ ] Remove old `vite.config.js` from root (keep as backup initially)
- [ ] Clean up any unused configuration files
- [ ] Optimize .gitignore for new structure
- [ ] Consider removing old playground duplicates (later phase)

## **Validation Checklist**

After completing all phases, verify:

- [ ] `yarn dev` works exactly as before (other developers unaffected)
- [ ] `yarn build` produces functional web application
- [ ] `yarn electron:dev` opens desktop application
- [ ] All existing routes and features work
- [ ] Hot reloading functions correctly
- [ ] Primitive components work in both web playground and main app
- [ ] Mobile platform structure is ready for future development
- [ ] No broken imports or missing assets
- [ ] Build output is clean and optimized

## **Rollback Plan**

If issues arise:

1. **Immediate Rollback**: 
   - [ ] Revert `package.json` scripts to original
   - [ ] Copy `platforms/web/main.tsx` back to `src/main.jsx`
   - [ ] Copy `platforms/web/index.html` back to root
   - [ ] Restore original `vite.config.js`

2. **Partial Rollback**:
   - [ ] Keep new structure but fix specific issues
   - [ ] Update import paths that may be incorrect
   - [ ] Fix any configuration file paths

## **Success Criteria**

- ✅ Web development workflow unchanged for other developers
- ✅ All existing functionality preserved
- ✅ Clean platform separation achieved
- ✅ Mobile development foundation established
- ✅ No performance regression
- ✅ Build and deployment processes work correctly

## **Timeline Estimate**

- **Phase 1-2**: 2-3 hours (basic structure and build config)
- **Phase 3**: 2-3 hours (platform abstraction)
- **Phase 4**: 1-2 hours (mobile placeholder)
- **Phase 5**: 2-3 hours (testing and validation)
- **Phase 6**: 1-2 hours (documentation)

**Total**: 8-13 hours for complete implementation

---

Updated: 2025-08-05 16:25:00