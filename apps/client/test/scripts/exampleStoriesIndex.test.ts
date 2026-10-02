/**
 * @jest-environment node
 */
import { join } from 'node:path';
import {
  readExampleStoryMeta,
  renderExampleStoriesIndex,
} from '../../scripts/lib/exampleStoriesIndex';

const contentDir = join(__dirname, '../../src/exampleStories/content');

describe('renderExampleStoriesIndex', () => {
  it('keeps the stories out of the bundle everybody downloads: no static import of any of them', () => {
    const { source, storyCount } = renderExampleStoriesIndex(contentDir);

    expect(storyCount).toBeGreaterThanOrEqual(6);
    // A static `import x from '...json'` is what put a megabyte of stories in the main bundle.
    expect(source).not.toMatch(/^import [A-Za-z_]+ from '.*\.json'/m);
    // Each one is a literal `import()` (Metro needs the string) behind a `load()`.
    expect(
      source.match(/load: \(\) =>\s*import\('\.\.\/content\//g)?.length,
    ).toBeGreaterThanOrEqual(12);
  });

  it('carries on each language what the list draws, copied from the story file', () => {
    const meta = readExampleStoryMeta(join(contentDir, 'goldilocks', 'en.json'));
    const { source } = renderExampleStoriesIndex(contentDir);

    expect(typeof meta.title).toBe('string');
    expect(source).toContain(JSON.stringify(meta));
  });

  it('stays small however many stories there are', () => {
    expect(renderExampleStoriesIndex(contentDir).source.length).toBeLessThan(20 * 1024);
  });
});
