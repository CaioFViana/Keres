// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      /**
       * Um tipo importado como valor mantém o módulo inteiro no grafo em tempo de execução:
       * `import { SceneSelect } from '../db/schema'` arrastava o drizzle e o expo-sqlite para
       * dentro de um componente que só desenha um cartão, e era o que fechava os ciclos entre
       * `navigation/` e `screens/` (cada tela importava o `ParamList` de volta como valor).
       * Ver o comentário em `utils/entityNavigation.ts`, que já dependia desta disciplina à mão.
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
]);
