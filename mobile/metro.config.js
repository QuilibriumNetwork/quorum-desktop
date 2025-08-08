const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'browser', 'require'],
  // Prioritize platform-specific files for React Native
  resolverMainFields: ['react-native', 'browser', 'main'],
  // Add Node.js polyfills - use shim files for better compatibility  
  alias: {
    crypto: path.resolve(projectRoot, 'shims/crypto.js'),
    stream: path.resolve(monorepoRoot, 'node_modules/readable-stream'),
    buffer: path.resolve(monorepoRoot, 'node_modules/buffer'),
  },
  // Custom resolver function for crypto module
  resolverMainFields: ['react-native', 'browser', 'main'],
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'crypto') {
      return {
        filePath: path.resolve(projectRoot, 'shims/crypto.js'),
        type: 'sourceFile',
      };
    }
    // Let Metro handle other modules
    return context.resolveRequest(context, moduleName, platform);
  },
};

// Support symlinks (used by Yarn workspaces)
config.resolver.symlinks = true;

module.exports = config;
