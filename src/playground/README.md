# Playground Directory

This directory contains testing environments for validating cross-platform primitives during development.

## Structure

```
src/playground/
├── web/                      # Web playground for testing primitives in browser
│   └── PrimitivesPlayground.tsx  # Current web playground component
└── mobile/                   # Mobile playground for React Native testing
    └── quorum-mobile-test/   # React Native test environment (created in Phase 1D)
```

## Usage

### Web Playground
The web playground is accessible through the main application at `/playground` route. It provides:
- Interactive testing of all primitives
- Theme and accent color switching
- Visual validation of primitive behavior
- Real-time testing during development

### Mobile Playground (Phase 1D)
The mobile playground will be created as a separate React Native app for testing primitives on mobile devices:
- Individual primitive testing screens
- Theme system validation
- Performance testing
- Complex composition testing

## Development Workflow

1. **Create primitive** in `src/components/primitives/`
2. **Test on web** using `src/playground/web/PrimitivesPlayground.tsx`
3. **Test on mobile** using `src/playground/mobile/quorum-mobile-test/`
4. **Fix issues** before proceeding to next primitive

This ensures cross-platform compatibility is validated early and often during development.

---

*Last updated: 2025-07-23*