const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the parent src/ directory and shared dependencies
config.watchFolders = [
  path.resolve(__dirname, '../src'),
  path.resolve(__dirname, '../node_modules'),
];

// Resolve modules from parent directory
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, '../node_modules'),
  path.resolve(__dirname, './node_modules'),
];

// Platform-specific file resolution (.native.tsx takes precedence over .tsx)
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

// Handle shared TypeScript paths
config.resolver.alias = {
  '@': path.resolve(__dirname, '../src'),
};

// Handle React Native specific modules
config.resolver.assetExts.push('wasm');

module.exports = config;