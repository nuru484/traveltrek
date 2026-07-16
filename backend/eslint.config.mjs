// @ts-check

import eslint from '@eslint/js';
import perfectionist from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/*.js', '**/*.mjs', 'generated/**', 'build/**', 'dist/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  perfectionist.configs['recommended-natural'],
  {
    // Underscore-prefixed names are an intentional "unused" marker
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Numbers interpolate unambiguously; everything else still errors
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },
  {
    // Test scaffolding and root config files may assert non-null on fixtures
    // they just created / know are present. Supertest response bodies are
    // typed `any`, so the unsafe-* family is off for assertions on them.
    files: ['test/**', '*.config.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
