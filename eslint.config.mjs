import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['site/vendor/**', 'build-pdf.js', 'osobni/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['site/**/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        pdfMake: 'readonly',
        CvFormat: 'readonly',
        module: 'readonly',
        self: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },
  {
    files: ['.github/ci/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  }
];
