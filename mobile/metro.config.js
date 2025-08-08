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
];

// Configure resolver for workspace
config.resolver = {
  ...config.resolver,
  // Use hoisted dependencies from workspace root
  nodeModulesPaths: [
    path.resolve(monorepoRoot, 'node_modules'),
  ],
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
    /.*node_modules[/\\]@quilibrium[/\\].*/,
  ]),
  // TEMPORARY: Redirect SDK to mock implementation for mobile
  // TODO: Remove this when proper SDK integration is implemented
  // See: .readme/tasks/todo/mobile-sdk-integration-issue.md
  extraNodeModules: {
    '@quilibrium/quilibrium-js-sdk-channels': path.resolve(
      monorepoRoot,
      'src/shims/quilibrium-sdk-channels.native.tsx'
    ),
  },
  // Force Metro to resolve our shim instead of the actual SDK
  resolveRequest: (context, moduleName, platform) => {
    // Intercept ALL attempts to load the Quilibrium SDK
    if (moduleName === '@quilibrium/quilibrium-js-sdk-channels' ||
        moduleName.includes('@quilibrium/quilibrium-js-sdk-channels') ||
        moduleName.includes('quilibrium-js-sdk-channels')) {
      console.log('[Metro] Redirecting SDK import to shim:', moduleName);
      return {
        filePath: path.resolve(monorepoRoot, 'src/shims/quilibrium-sdk-channels.native.tsx'),
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
