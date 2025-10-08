// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      // --- ADD THIS BLOCK ---
      parserOptions: {
        // Tell ESLint to parse files as ES Modules
        sourceType: 'module',
        // Allow for the latest ECMAScript features
        ecmaVersion: 'latest',
      },
      // --------------------
    },
    rules: {
      // Your custom rules here
    },
  },
];
