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
      /**
       * React Hooks v6 rules, new as errors in eslint-config-expo 57: 313 findings on code
       * the SDK 55 gate accepted (refs-during-render in animation code, setState-in-effect
       * data fetching, manual memoization the compiler would own). Each fix is a
       * behavior-touching refactor that needs device verification, so they land here as
       * warnings for gradual adoption instead of blocking the SDK 57 upgrade. Revisit and
       * re-tighten rule by rule; do not add new violations.
       */
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
