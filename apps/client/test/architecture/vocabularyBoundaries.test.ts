/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SOURCE_ROOT = resolve(__dirname, '../../src');
const read = (path: string) => readFileSync(join(SOURCE_ROOT, 'screens', path), 'utf8');

/**
 * Vocabulary is deliberately a presentation layer. A form for a vocabulary-aware entity must not
 * quietly reintroduce its old English/Portuguese noun through a specialised description key.
 */
describe('vocabulary presentation boundaries', () => {
  const forms = [
    ['characters/CharacterFormScreen.tsx', 'character_form_description'],
    ['locations/LocationFormScreen.tsx', 'location_form_description'],
    ['items/ItemFormScreen.tsx', 'item_form_description'],
    ['worldrules/WorldRuleFormScreen.tsx', 'world_rule_form_description'],
    ['narrative-elements/chapters/ChapterFormScreen.tsx', 'chapter_form_description'],
    ['narrative-elements/scenes/SceneFormScreen.tsx', 'scene_form_description'],
    ['narrative-elements/choices/ChoiceFormScreen.tsx', 'choice_form_description'],
  ] as const;

  it.each(forms)('%s derives its description from the configured vocabulary', (path, oldKey) => {
    const source = read(path);
    expect(source).toContain('copy.formDescription');
    expect(source).not.toContain(`t('${oldKey}')`);
  });

  it('does not hard-code Scene labels inside the Choice form', () => {
    const source = read('narrative-elements/choices/ChoiceFormScreen.tsx');
    expect(source).toContain("t('vocabulary_parent_entity', { entity: sceneCopy.entity })");
    expect(source).toContain("t('vocabulary_next_entity', { entity: sceneCopy.entity })");
    expect(source).not.toContain("t('parent_scene')");
    expect(source).not.toContain("t('next_scene')");
  });
});
