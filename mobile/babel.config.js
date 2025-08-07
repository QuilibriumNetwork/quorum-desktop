module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Lingui babel plugin for i18n
      '@lingui/babel-plugin-lingui-macro',
      // React Native Reanimated plugin (if we add animations later)
      // 'react-native-reanimated/plugin',
    ],
  };
};