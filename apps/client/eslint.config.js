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
       * React Hooks v6 rules, new as errors in eslint-config-expo 57 (313 findings on code
       * the SDK 55 gate accepted). All five were revisited and re-tightened:
       *
       * - refs / set-state-in-effect / immutability / purity are back at error: every
       *   finding was either refactored (render-adjust sync, useMemo services, index
       *   lookbacks) or suppressed per line with a justification the rule cannot verify
       *   (async-callback boundaries, reanimated shared values, gesture-only responders).
       * - preserve-manual-memoization stays off, deliberately: without the React Compiler
       *   in the toolchain it only asks to pessimize already-optimal property-level deps
       *   (`[story?.id]` -> `[story]`, recreating callbacks on every field change). The one
       *   genuine ordering bug it surfaced (inputStyles used before declaration in
       *   StoryCalendarFormScreen) was fixed by moving the memo above its user.
       * Do not add new violations.
       */
      'react-hooks/refs': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'error',
      'react-hooks/purity': 'error',
    },
  },
]);
