/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SOURCE_ROOT = resolve(__dirname, '../../src');

/**
 * Every form footer pairing a destructive action with save: delete sits LEFT, save sits RIGHT.
 * Order in the file is the visual order (the buttons are static JSX siblings), so comparing
 * the buttons' line numbers pins the layout without mounting sixteen screens.
 *
 * The forms that use `EntityFormActions` have one footer between them, so that component is the
 * single place the order is checked for them.
 */
type FormFooterCheck = { file: string; save: RegExp; remove: RegExp };

const OWN_FOOTER_SAVE = /onPress=\{handleSave\}/;
const OWN_FOOTER_REMOVE = /onPress=\{handleDelete\w*\}/;

const SAVE_DELETE_FORMS: FormFooterCheck[] = [
  {
    file: 'components/common/forms/EntityFormActions/EntityFormActions.tsx',
    save: /onPress=\{onSave\}/,
    remove: /onPress=\{onDelete\}/,
  },
  ...[
    'screens/enterstack/ServerRegistrationScreen.tsx',
    'screens/enterstack/StoryFormScreen.tsx',
    'screens/gallery/GalleryDetailContent.tsx',
    'screens/itemJourneys/ItemJourneyFormScreen.tsx',
    'screens/plots/PlotFormScreen.tsx',
    'screens/routes/RouteFormScreen.tsx',
  ].map((file) => ({ file, save: OWN_FOOTER_SAVE, remove: OWN_FOOTER_REMOVE })),
];

/** Forms whose footer is `EntityFormActions`: each must hand it its own save and delete handlers. */
const FORMS_USING_ENTITY_FORM_ACTIONS = [
  'screens/characters/CharacterFormContent.tsx',
  'screens/items/ItemFormScreen.tsx',
  'screens/locations/LocationFormContent.tsx',
  'screens/narrative-elements/chapters/ChapterFormScreen.tsx',
  'screens/narrative-elements/choices/ChoiceFormScreen.tsx',
  'screens/narrative-elements/scenes/SceneFormScreen.tsx',
  'screens/notes/NoteFormScreen.tsx',
  'screens/tags/TagFormScreen.tsx',
  'screens/worldrules/WorldRuleFormScreen.tsx',
];

describe('form action order', () => {
  it.each(SAVE_DELETE_FORMS)('places delete left of save in $file', ({ file, save, remove }) => {
    const lines = readFileSync(join(SOURCE_ROOT, file), 'utf8').split('\n');
    const saveLine = lines.findIndex((line) => save.test(line));
    const deleteLine = lines.findIndex((line) => remove.test(line));

    expect(deleteLine).toBeGreaterThanOrEqual(0);
    expect(saveLine).toBeGreaterThanOrEqual(0);
    expect(deleteLine).toBeLessThan(saveLine);
  });

  it.each(FORMS_USING_ENTITY_FORM_ACTIONS)(
    'hands its own save and delete handlers to the shared footer in $file',
    (file) => {
      const source = readFileSync(join(SOURCE_ROOT, file), 'utf8');

      expect(source).toMatch(/<EntityFormActions\b/);
      expect(source).toMatch(/onDelete=\{handleDelete\w*\}/);
      expect(source).toMatch(/onSave=\{handleSave\}/);
    },
  );
});
