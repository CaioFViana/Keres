import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['node_modules/', 'dist/', 'coverage/'] },
  {
    // `test/` and the Vitest config are TypeScript too: without them here, ESLint's default parser
    // (espree) tries to read type annotations and fails with "Unexpected token".
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}', 'vitest.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      /**
       * Type imports written as such. Without this, a type imported as a value keeps the whole
       * module in the runtime graph - that is how ten client components dragged drizzle and
       * expo-sqlite along just to draw a card. It is also what `verbatimModuleSyntax` enforces at
       * the compiler level.
       */
      /**
       * Values come from `@keres/shared` by path (`@keres/shared/utils/tierPricing`), never from the
       * barrel: Vite cannot prove the package free of side effects, so one value imported from
       * `index.ts` keeps every schema in the bundle (and zod with them). Types are erased and may
       * keep coming from the barrel.
       */
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@keres/shared',
              message:
                'Import values by path, e.g. @keres/shared/utils/colorUtils (types may use the barrel).',
              allowTypeImports: true,
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // `disallowTypeAnnotations` turned off: `typeof import('...')` inside an annotation loads no
        // module at all, and it is what allows typing a module that is deliberately imported late
        // (see the S3BlobStorage test, which only imports after setting up the environment).
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
    },
  },
  {
    // Tests are not bundled: the barrel costs them nothing.
    files: ['test/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },
];
