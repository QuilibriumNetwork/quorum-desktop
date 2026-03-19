const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Monorepo setup with Yarn Workspaces
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

// Watch shared source folders
config.watchFolders = [
  path.resolve(monorepoRoot, 'src'),
  path.resolve(monorepoRoot, '..', 'quorum-shared'), // Symlinked @quilibrium/quorum-shared
];

// Empty module used to satisfy root package resolution (see resolveRequest below)
const emptyModulePath = path.resolve(projectRoot, '__empty.js');

// Configure resolver for workspace
config.resolver = {
  ...config.resolver,
  // Use hoisted dependencies from workspace root
  nodeModulesPaths: [path.resolve(monorepoRoot, 'node_modules')],
  platforms: ['native', 'android', 'ios'],
  // Handle ES modules properly
  sourceExts: [...config.resolver.sourceExts, 'mjs', 'cjs'],
  unstable_enablePackageExports: false,
  unstable_conditionNames: ['react-native', 'browser', 'require'],
  // Prioritize platform-specific files for React Native
  resolverMainFields: ['react-native', 'main'],
  // TEMPORARY: Block the actual SDK package from being resolved
  // This ensures Metro doesn't accidentally load the real SDK
  blockList: exclusionList([
    /.*[/\\]@quilibrium[/\\]quilibrium-js-sdk-channels[/\\].*/,
    // Exclude the root web/ directory (Vite/Electron entry points) from Metro bundling.
    // Uses an anchored pattern to avoid blocking web/ dirs inside node_modules packages.
    new RegExp(
      monorepoRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[/\\\\]web[/\\\\].*'
    ),
    /.*[/\\]node_modules[/\\]electron[/\\].*/,
    /.*[/\\]node_modules[/\\]electron-builder[/\\].*/,
    // Block quorum-shared's own node_modules — use quorum-desktop's deps instead
    /.*[/\\]quorum-shared[/\\]node_modules[/\\].*/,
  ]),
  // TEMPORARY: Redirect SDK to mock implementation for mobile
  // TODO: Remove this when proper SDK integration is implemented
  // See: .agents/tasks/todo/mobile-sdk-integration-issue.md
  extraNodeModules: {
    '@quilibrium/quilibrium-js-sdk-channels': path.resolve(
      monorepoRoot,
      'src/shims/quilibrium-sdk-channels.native.tsx'
    ),
    '@quilibrium/quorum-shared': path.resolve(
      monorepoRoot,
      '..', 'quorum-shared'
    ),
  },
  resolveRequest: (context, moduleName, platform) => {
    const origin = context.originModulePath || '';
    const normalizedOrigin = origin.replace(/\\/g, '/');

    // Redirect root package entry point to mobile entry.
    // Expo sets unstable_serverRoot to the workspace root (quorum-desktop/).
    // When the native app requests /index.bundle, Metro resolves "./index" from the root.
    // The root package.json has "main": "web/electron/main.cjs" (blocked), so Metro
    // falls back to ./index which doesn't exist. Redirect to the actual mobile entry point.
    if (
      moduleName === './index' &&
      normalizedOrigin.endsWith('/quorum-desktop/.')
    ) {
      return {
        filePath: path.resolve(projectRoot, 'index.ts'),
        type: 'sourceFile',
      };
    }

    // Resolve multiformats subpath imports (e.g., multiformats/bases/base58).
    // Metro doesn't support package.json "exports" with unstable_enablePackageExports: false,
    // so we manually map subpath imports to their dist files.
    if (moduleName.startsWith('multiformats/')) {
      const subpath = moduleName.replace('multiformats/', '');
      return {
        filePath: path.resolve(
          monorepoRoot,
          'node_modules/multiformats/dist/src',
          subpath + '.js'
        ),
        type: 'sourceFile',
      };
    }

    // Intercept ALL attempts to load the Quilibrium SDK
    if (
      moduleName === '@quilibrium/quilibrium-js-sdk-channels' ||
      moduleName.includes('@quilibrium/quilibrium-js-sdk-channels') ||
      moduleName.includes('quilibrium-js-sdk-channels')
    ) {
      return {
        filePath: path.resolve(
          monorepoRoot,
          'src/shims/quilibrium-sdk-channels.native.tsx'
        ),
        type: 'sourceFile',
      };
    }
    // Let Metro handle other modules normally
    return context.resolveRequest(context, moduleName, platform);
  },
};

// Support symlinks (used by Yarn workspaces)
config.resolver.symlinks = true;

module.exports = config;
