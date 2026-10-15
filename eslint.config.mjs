// Revisor de código de la tienda (npm run lint). Sobre todo avisa de lo que
// sobra: imports y variables sin usar (los imports sin usar se quitan solos con
// `npm run lint -- --fix`), y de hooks de React mal llamados.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  {
    ignores: ['build/**', 'android/**', 'functions/**', 'node_modules/**', 'public/**', 'ops/**', 'docs/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // process.env lo reemplaza Vite al compilar (vite.config.js → define).
      globals: { ...globals.browser, process: 'readonly' },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'unused-imports': unusedImports },
    rules: {
      // Lo que se usa solo dentro de JSX (<Componente />) cuenta como usado.
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn', {
        vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_',
        caughtErrors: 'none', ignoreRestSiblings: true,
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Pruebas y scripts que corren con Node.
    files: ['src/**/*.test.mjs', 'scripts/**/*.{js,mjs}', '*.config.js', 'vite.*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
