import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  files: ['**/*.{js,mjs,cjs,ts}'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      project: './tsconfig.json',
    },
    globals: {
      ...globals.node,
    },
  },
  rules: {
    'no-console': ['warn', { allow: ['error', 'log'] }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
});
