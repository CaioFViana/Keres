import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['node_modules/', 'dist/', 'coverage/'] },
  {
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
       * Import de tipo escrito como tal. Sem isto, um tipo importado como valor mantém o
       * módulo inteiro no grafo de execução - foi assim que dez componentes do cliente
       * arrastavam drizzle e expo-sqlite só para desenhar um cartão. É também o que
       * `verbatimModuleSyntax` cobra do compilador.
       */
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // `disallowTypeAnnotations` desligado: `typeof import('...')` dentro de uma anotação
        // não carrega módulo nenhum, e é o que permite tipar um módulo carregado tarde de
        // propósito (ver o teste do S3BlobStorage, que só importa depois de montar o ambiente).
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
    },
  },
];
