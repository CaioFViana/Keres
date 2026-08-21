import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['node_modules/', 'dist/', 'coverage/'] },
  {
    // `test/` e a config do Vitest também são TypeScript: sem eles aqui, o parser padrão do
    // ESLint (espree) tenta ler anotações de tipo e falha com "Unexpected token".
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}', 'vitest.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
