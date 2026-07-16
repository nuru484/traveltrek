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
        projectService: {
          // Root-level prisma scripts are not part of the build tsconfig
          allowDefaultProject: ['prisma.config.ts', 'prisma/*.ts'],
        },
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
    // they just created / know are present.
    files: ['test/**', '*.config.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // TEMPORARY: the legacy fat controllers and express-validator chains are
    // being replaced wholesale by the service-layer + zod refactor. Relax the
    // type-safety rules there until each domain is rewritten, instead of
    // hand-typing code that is about to be deleted. Remove entries from this
    // block as domains migrate; delete the whole block when the refactor lands.
    files: ['src/controllers/**', 'src/validations/**', 'src/middlewares/validation.ts'],
    rules: {
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
);
