// frontend/eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off', // Next.js already handles React
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      'no-console': 'warn',
    },
  },
  prettierConfig,
];
