const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable shared src/ folder usage
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

config.watchFolders = [monorepoRoot];

// Add path alias support for shared src and local mobile files
config.resolver.alias = {
  // Local mobile paths
  '@': path.resolve(__dirname, './'),
  '@/screens': path.resolve(__dirname, './screens'),
  '@/components': path.resolve(__dirname, './components'),
  
  // Shared src folder - this is the key alias
  'src': path.resolve(monorepoRoot, 'src'),
  '@/src': path.resolve(monorepoRoot, 'src'),
  
  // Specific shortcuts for commonly used shared paths
  '@/primitives': path.resolve(monorepoRoot, 'src/components/primitives'),
  '@/shared': path.resolve(monorepoRoot, 'src'),
};

// Enable node_modules resolution from project root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Add support for platform-specific extensions and scss files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'scss', 'sass'];
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

// Ensure proper platform resolution order for React Native
// Metro will look for .native.tsx first, then .tsx
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

module.exports = config;
