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
// same-directory relative import is caught too, e.g. mentionPillDom.ts
// importing './resolveMemberName' — a `**/utils/<name>` pattern would not
// match that specifier, since the importing file already lives in utils/
// and its own import never spells out "utils/".
const noResolverImportsRules = {
  'no-restricted-imports': ['error', {
    patterns: [
      {
        group: ['**/resolveMemberName', '**/conversationSearch', '**/profileCardIdentity',
                '**/resolveGlobalSender', '**/resolveSelfName'],
        message:
          'Resolve names via src/identity (<MemberName> / useResolvedName). ' +
          'See .agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md',
      },
      // mentionPillDom is split from the group above: it still resolves a
      // name itself (resolveMentionPillName, used by its own unmigrated
      // ratchet entry below) but also exports pure DOM helpers
      // (createPillElement, extractPillDataFromOption, the DOM-walk
      // serializers) that do no resolution at all. A migrated file is
      // allowed to import those — only the resolving export is restricted,
      // not the whole module.
      {
        group: ['**/mentionPillDom'],
        importNames: ['resolveMentionPillName'],
        message:
          'Resolve names via src/identity (<MemberName> / useResolvedName), not ' +
          'resolveMentionPillName. See .agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md',
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
  {
    // RATCHET — every entry is a production file still to migrate to
    // src/identity (<MemberName> / useResolvedName). Shrinks to zero during
    // Phase D and this whole block is deleted in Phase E. Remove your file
    // from it as part of migrating it. Never add one.
    files: [
      'src/components/modals/SpaceSettingsModal/Account.tsx',
      'src/components/thread/ThreadPanel.tsx',
      'src/components/thread/ThreadsListPanel.tsx',
      'src/components/user/UserProfile.tsx',
      'src/components/user/ResolvedName.tsx',
      'src/components/direct/DirectMessage.tsx',
      'src/components/direct/DirectMessageContact.tsx',
      'src/components/direct/DirectMessageContactsList.tsx',
      'src/components/direct/DMUserProfileSidebar.tsx',
      'src/components/space/Channel.tsx',
      'src/hooks/business/mentions/useMentionInput.ts',
      'src/hooks/business/spaces/useInviteManagement.ts',
      'src/hooks/business/notifications/useGlobalSenderResolver.ts',
      'src/utils/mentionPillDom.ts',
      'src/utils/conversationSearch.ts',
      'src/utils/profileCardIdentity.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // RATCHET (tests) — direct unit tests of the six low-level resolver
    // modules above, asserting THEIR behaviour while they still exist. Each
    // entry disappears when its module (and this test) is deleted in Phase
    // E, not when "migrated" in the Phase D sense — so this list shrinks on
    // its own schedule, not in lockstep with the production list above. A
    // test that imports one of these modules for any other reason (e.g. to
    // work around this rule instead of testing through <MemberName> /
    // useResolvedName) does not belong here.
    files: [
      'src/dev/tests/utils/profileCardIdentity.test.ts',
      'src/dev/tests/utils/resolveNameForContext.test.ts',
      'src/dev/tests/utils/selfNamePlaceholder.test.ts',
      'src/dev/tests/utils/conversationSearch.test.ts',
      'src/dev/tests/utils/mentionPillName.test.ts',
      'src/dev/tests/utils/resolveMemberNameQnsGuard.test.ts',
      'src/dev/tests/utils/mentionPillDom.unit.test.ts',
      'src/dev/tests/utils/identityPlaceholder.test.ts',
      'src/dev/tests/utils/resolveGlobalSender.globalSlot.test.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
];
