import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Exigés nommément par CONTRIBUTING.md §6.
      'no-unused-vars': 'off', // remplacé par la version TypeScript ci-dessous
      '@typescript-eslint/no-unused-vars': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  // En dernier : désactive les règles de style qui entreraient en conflit avec
  // prettier, qui est seul responsable du formatage.
  prettier
);
