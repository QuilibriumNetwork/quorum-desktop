module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      '@lingui/babel-plugin-lingui-macro',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@/test': './test',
            '@/test-primitives': './test/primitives',
            '@/test-business': './test/business',
            '@/styles': './styles',
            '@/primitives': '../src/components/primitives',
            '@/components': '../src/components',
            '@/hooks': '../src/hooks',
            '@/utils': '../src/utils',
            '@/src': '../src',
          },
        },
      ],
    ],
  };
};
