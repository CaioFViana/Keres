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
 */
const SAVE_DELETE_FORMS: { file: string; save: RegExp; remove: RegExp }[] = [
  { file: 'screens/characters/CharacterFormContent.tsx' },
  { file: 'screens/enterstack/ServerRegistrationScreen.tsx' },
  { file: 'screens/enterstack/StoryFormScreen.tsx' },
  { file: 'screens/gallery/GalleryDetailContent.tsx' },
  { file: 'screens/itemJourneys/ItemJourneyFormScreen.tsx' },
  { file: 'screens/items/ItemFormScreen.tsx' },
  { file: 'screens/locations/LocationFormContent.tsx' },
  { file: 'screens/mainstorystack/StorySettingsScreen.tsx' },
  { file: 'screens/narrative-elements/chapters/ChapterFormScreen.tsx' },
  { file: 'screens/narrative-elements/choices/ChoiceFormScreen.tsx' },
  { file: 'screens/narrative-elements/scenes/SceneFormScreen.tsx' },
  { file: 'screens/notes/NoteFormScreen.tsx' },
  { file: 'screens/plots/PlotFormScreen.tsx' },
  { file: 'screens/routes/RouteFormScreen.tsx' },
  { file: 'screens/tags/TagFormScreen.tsx' },
  { file: 'screens/worldrules/WorldRuleFormScreen.tsx' },
].map((entry) => ({
  ...entry,
  save: /onPress=\{handleSave\}/,
  remove: /onPress=\{handleDelete\w*\}/,
}));

describe('form action order', () => {
  it.each(SAVE_DELETE_FORMS)('places delete left of save in $file', ({ file, save, remove }) => {
    const lines = readFileSync(join(SOURCE_ROOT, file), 'utf8').split('\n');
    const saveLine = lines.findIndex((line) => save.test(line));
    const deleteLine = lines.findIndex((line) => remove.test(line));

    expect(deleteLine).toBeGreaterThanOrEqual(0);
    expect(saveLine).toBeGreaterThanOrEqual(0);
    expect(deleteLine).toBeLessThan(saveLine);
  });
});
