const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add path alias support
config.resolver.alias = {
  '@': path.resolve(__dirname, './'),
  '@/components': path.resolve(__dirname, './components'),
  '@/screens': path.resolve(__dirname, './screens'),
  '@/primitives': path.resolve(__dirname, './components/primitives'),
};

// Add support for web extensions and scss files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'scss', 'sass'];

module.exports = config;