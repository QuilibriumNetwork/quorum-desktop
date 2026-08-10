import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// Nothing outside src/identity/ may resolve a name itself. Call sites use
// <MemberName> / useResolvedName, which take an ADDRESS — you cannot forget
// a field you never pass.
//
// Patterns are bare module names (no forced "utils/" segment) so a
// same-directory relative import is caught too, e.g. a hypothetical
// utils/ sibling importing './resolveMemberName' — a `**/utils/<name>`
// pattern would not match that specifier, since the importing file already
// lives in utils/ and its own import never spells out "utils/".
//
// `resolveMemberName`, `resolveSelfName`, `conversationSearch` and
// `profileCardIdentity` themselves are gone (deleted by the migration this
// rule enforces) — the patterns stay so the names can never be reintroduced.
// `mentionPillDom` came off this list in Task 7: it no longer resolves a
// name at all (resolveMentionPillName was deleted with it), so there is
// nothing left on that module for the rule to restrict.
const deadModulePatterns = [
  {
    group: ['**/resolveMemberName', '**/conversationSearch', '**/profileCardIdentity',
            '**/resolveSelfName'],
    message:
      'Resolve names via src/identity (<MemberName> / useResolvedName). ' +
      'See .agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md',
  },
];

const noResolverImportsRules = {
  'no-restricted-imports': ['error', { patterns: deadModulePatterns }],
};

// Fix round 1 on Phase D rows 22-24: after Task 7 deleted resolveMemberName /
// conversationSearch / profileCardIdentity / resolveSelfName, the rule above
// could no longer fire on anything that still exists — a tombstone, not a
// guard. What everyone now reaches for instead is the LOW-LEVEL primitive
// underneath src/identity's own public API: `resolveIdentity` (the tier
// picker, from @quilibrium/quorum-shared) and `identityFromMaps` (the tier
// ASSEMBLER, src/identity/identityProvider.ts). Restrict those directly, so
// the rule guards the thing that actually matters again. App code uses
// <MemberName> / useResolvedName / useNameResolver — nothing else needs
// either primitive.
//
// Scoped to `src/**` with `ignores: ['src/identity/**']` below (not baked
// into `noResolverImportsRules` itself) because src/identity/ is the module
// that legitimately calls both — useNameResolver.ts and useResolvedName.ts
// import identityFromMaps directly, and identityFromMaps itself calls
// resolveIdentity nowhere (resolveIdentity is called by useResolvedName.ts
// too). Restricting them globally would break the module meant to own them.
const identityPrimitivePatterns = [
  ...deadModulePatterns,
  {
    group: ['**/identityProvider'],
    importNames: ['identityFromMaps'],
    message:
      'identityFromMaps is the tier ASSEMBLER internal to src/identity — only ' +
      'src/identity/ may call it directly. Resolve via <MemberName> / ' +
      'useResolvedName / useNameResolver instead. See .agents/issues/.open/' +
      '2026-08-10-identity-resolution-architecture-design.md',
  },
];
const noIdentityPrimitiveImportRules = {
  'no-restricted-imports': ['error', {
    patterns: identityPrimitivePatterns,
    paths: [
      {
        name: '@quilibrium/quorum-shared',
        importNames: ['resolveIdentity'],
        message:
          'resolveIdentity is the low-level tier PICKER — only src/identity/ may ' +
          'call it directly. Resolve via <MemberName> / useResolvedName / ' +
          'useNameResolver instead. See .agents/issues/.open/' +
          '2026-08-10-identity-resolution-architecture-design.md',
      },
    ],
  }],
};

export default [
  {
    ignores: [
      'dist',
      'mobile/android/**',
      'mobile/ios/**',
      'node_modules/**',
      // Git worktrees live here by convention and are full second checkouts,
      // each with its own tsconfig.json. Without this, typescript-eslint finds
      // several candidate tsconfigRootDirs and fails to parse EVERY file:
      //   "No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs
      //    are present" — 1383 errors, none of them real.
      // Already in .gitignore; eslint's flat config does not read that.
      '.worktrees/**',
      '**/*.config.js',
      'public/wasm_exec.js',
      'mobile/babel.config.js',
      'mobile/metro.config.js',
      'mobile/postcss.config.js',
      'mobile/tailwind.config.js',
      'mobile/update-theme.js',
      '.claude/**',
      '.agents/**',
      'mobile/test/**',
      'src/i18n/**', // Auto-generated translation files
    ],
  },
  // Node.js CJS files (Metro shim etc.)
  {
    files: ['mobile/__empty.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // JavaScript/JSX files
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '19.0' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...noResolverImportsRules,
      'react/jsx-no-target-blank': 'off',
      'react/prop-types': 'off', // TypeScript already validates prop types
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // ESLint 10 new rules - deferred for follow-up
      'preserve-caught-error': 'warn',
      // React Compiler rules (react-hooks@7) - disabled pending React Compiler adoption
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  // TypeScript/TSX files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '19.0' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...tseslint.configs.recommended[1]?.rules,
      ...noResolverImportsRules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type
      'no-unused-vars': 'off', // Turn off base rule (use TS version instead)
      'react/display-name': 'off', // Allow anonymous components (forwardRef, memo)
      'react/no-unescaped-entities': 'off', // Allow quotes/apostrophes in JSX (needed for i18n)
      'react/prop-types': 'off', // TypeScript already validates prop types
      'func-params-args/func-args': 'off', // Plugin not installed
      // ESLint 10 new rules - deferred for follow-up
      'preserve-caught-error': 'warn',
      // React Compiler rules (react-hooks@7) - disabled pending React Compiler adoption
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  // Restrict the low-level identity-resolution primitives (resolveIdentity,
  // identityFromMaps) to src/identity/ — see noIdentityPrimitiveImportRules'
  // doc comment above. Narrower `files`/wider precedence (defined AFTER the
  // general TS/TSX block above) means this REPLACES `no-restricted-imports`
  // for every matching file; `ignores` keeps src/identity/ itself out of
  // that replacement so it retains the dead-module-only rule.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/identity/**'],
    rules: noIdentityPrimitiveImportRules,
  },
  // Exemption: direct unit tests of the ladder's own behaviour (the tier
  // ASSEMBLER and the tier PICKER), asserting what they compute rather than
  // going through <MemberName>/useResolvedName like every other test does.
  // A component importing the primitive is not a fair exemption; a test
  // whose entire job is pinning the primitive's own behaviour is — see
  // each file's own doc comment for why it needs the real function instead
  // of a mock. Defined AFTER the block above so it wins for these two files.
  {
    files: [
      'src/dev/tests/identity/identityProvider.test.tsx',
      'src/dev/tests/identity/identityResolvePerf.test.ts',
    ],
    rules: noResolverImportsRules,
  },
];
