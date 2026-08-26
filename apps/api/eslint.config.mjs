import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['node_modules/', 'dist/', 'dist-server/', 'drizzle/', 'coverage/'] },
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'vitest.config.ts', 'vitest.integration.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
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
];
