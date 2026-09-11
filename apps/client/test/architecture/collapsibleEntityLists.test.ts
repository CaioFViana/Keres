/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SOURCE_ROOT = resolve(__dirname, '../../src');

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const relativeOf = (path: string) => relative(SOURCE_ROOT, path).replace(/\\/g, '/');

/**
 * A collapsible card that lists story entities uses `EntityRelationList` for the rows.
 * Cards that are not entity lists stay here; a new card of entities without the shared
 * rows fails this test instead of shipping the old rounded-item look again.
 *
 * `toEqual` refuses both a new file and a name that stays listed after the exception ends.
 */
const COLLAPSIBLE_CARDS_WITHOUT_ENTITY_ROWS = [
  // Not a list of entities: metadata, dashboard totals, the stat editor, analysis findings.
  'components/common/display/EntityMetadata/EntityMetadata.tsx',
  'components/common/display/SummaryCard/SummaryCard.tsx',
  'components/features/stats/CharacterStatValuesEditor/CharacterStatValuesEditor.tsx',
  'screens/mainstorystack/StoryAnalysisScreen.tsx',
];

describe('collapsible entity lists', () => {
  it('lists entities inside CollapsibleCard through EntityRelationList', () => {
    const offenders = listSourceFiles(SOURCE_ROOT)
      .filter((path) => !relativeOf(path).endsWith('CollapsibleCard/CollapsibleCard.tsx'))
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes('<CollapsibleCard') && !source.includes('EntityRelationList');
      })
      .map(relativeOf)
      .sort();

    expect(offenders).toEqual([...COLLAPSIBLE_CARDS_WITHOUT_ENTITY_ROWS].sort());
  });
});
