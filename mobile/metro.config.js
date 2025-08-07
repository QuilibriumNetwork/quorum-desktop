const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Set project root to the mobile folder (not monorepo root)
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

// Configure watch folders to include the shared src
config.watchFolders = [
  path.resolve(monorepoRoot, 'src'),
];

// Configure resolver for ES module compatibility
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    // Prioritize mobile node_modules to avoid React version conflicts
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
  ],
  platforms: ['native', 'android', 'ios'],
  // Handle ES modules from parent package.json
  sourceExts: [...config.resolver.sourceExts, 'mjs', 'cjs'],
  // Disable experimental features that cause issues with ES modules
  unstable_enablePackageExports: false,
  unstable_conditionNames: ['react-native', 'browser', 'require'],
  
  // Force single React instance resolution
  alias: {
    'react': path.resolve(projectRoot, 'node_modules', 'react'),
    'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),
  },
};

// Configure transformer for better ES module support
config.transformer = {
  ...config.transformer,
  // Ensure proper handling of CommonJS/ES module interop
  unstable_allowRequireContext: false,
};

module.exports = config;
