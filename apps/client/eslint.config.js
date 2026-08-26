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
       * A type imported as a value keeps the whole module in the runtime graph:
       * `import { SceneSelect } from '../db/schema'` dragged drizzle and expo-sqlite into
       * a component that only draws a card, and it was what closed the cycles between
       * `navigation/` and `screens/` (each screen imported the `ParamList` back as a value).
       * See the comment in `utils/entityNavigation.ts`, which already depended on this discipline by hand.
       */
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // `disallowTypeAnnotations` off: `typeof import('...')` inside an annotation
        // loads no module at all, and it is what allows typing a module deliberately loaded
        // late (see the S3BlobStorage test, which only imports after setting the environment up).
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
    },
  },
]);
