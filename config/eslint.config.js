const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

const appBrowserGlobals = {
  FaviconConfig: 'readonly',
  AppPreloader: 'readonly',
  translations: 'readonly',
  I18n: 'readonly'
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'artifacts/**',
      'Github-Build-Release/**',
      'Pro-Installer/**',
      'src/resources/bin/**',
      '**/*.min.js'
    ]
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...appBrowserGlobals
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-control-regex': 'off',
      'no-useless-escape': 'warn',
      'no-async-promise-executor': 'warn',
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error'
    }
  },

  {
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...appBrowserGlobals
      }
    }
  },

  prettier
];
