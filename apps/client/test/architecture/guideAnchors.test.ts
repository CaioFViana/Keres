/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { screenGuides } from '../../src/guides/registry';

const SOURCE_ROOT = resolve(__dirname, '../../src');

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

// What the screens and components place, not what the tours say: the guides folder is left out.
const source = listSourceFiles(SOURCE_ROOT)
  .filter((path) => !relative(SOURCE_ROOT, path).replace(/\\/g, '/').startsWith('guides/'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')
  // JSX may break its attributes over lines; the test reads them as one run.
  .replace(/\s+/g, ' ');

/** Every anchor a tour points at, with the step that points at it. */
const references = Object.values(screenGuides).flatMap((guide) =>
  guide.steps.flatMap((step) =>
    (step.anchors ?? [])
      .filter((anchor) => !anchor.startsWith('drawer:'))
      .map((anchor) => ({ guide: guide.id, step: step.id, anchor })),
  ),
);

/**
 * A tour that points at something nobody registers shows a card with no hole and no warning - the
 * failure is silent. This holds every anchor a tour names to a place in the source that provides it.
 */
describe('guide anchors', () => {
  it('has something to check', () => {
    expect(references.length).toBeGreaterThan(40);
  });

  it.each(references)('$guide / $step: $anchor is provided by a screen', ({ anchor }) => {
    if (anchor.startsWith('header:')) {
      // A header action is named by its icon.
      const icon = anchor.slice('header:'.length);
      expect(source).toContain(`'${icon}'`);
      return;
    }
    const [, screen, part] = anchor.split(':');
    // Placed by the hook, or by the GuideAnchor component that wraps it.
    const direct = [`'${screen}', '${part}'`, `screen="${screen}" part="${part}"`];
    // The shared list names its search and controls by the entity it lists.
    const sharedList =
      (part === 'search' || part === 'controls') && source.includes(`entityName="${screen}"`);
    expect(direct.some((form) => source.includes(form)) || sharedList).toBe(true);
  });
});
