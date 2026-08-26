import { describeStoryIntegrityViolations, findStoryExportIntegrityErrors } from '@keres/shared';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyNarrative } from './lib/applyExampleNarrative';
import { exampleStoryNarratives } from './lib/exampleStoryNarrative';

/**
 * Writes the authored narratives in `lib/exampleStoryNarrative.ts` over the bundled example stories.
 *
 * Kept apart from `build-example-story.ts`, which builds the mechanical scaffolding (stat ladders,
 * schema fields, the tag palette) and knows nothing about what any of these stories is about. This
 * one only rewrites what a reader sees, leaves every id where it was, and refuses to write a story
 * whose rows would contradict one another.
 *
 * Run it for one story with `bun scripts/apply-example-narrative.ts <slug>`, or for every authored
 * story with no argument.
 */
const CONTENT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/exampleStories/content',
);

const requested = process.argv[2];
const slugs = requested ? [requested] : Object.keys(exampleStoryNarratives);

for (const slug of slugs) {
  const localized = exampleStoryNarratives[slug];
  if (!localized) throw new Error(`No authored narrative for "${slug}".`);

  for (const language of ['en', 'pt'] as const) {
    const file = join(CONTENT_ROOT, slug, `${language}.json`);
    const story = JSON.parse(readFileSync(file, 'utf8'));
    const written = applyNarrative(slug, story, localized[language]);

    const violations = findStoryExportIntegrityErrors(written as { story: { id: string } });
    if (violations.length) {
      throw new Error(
        `${slug}/${language} would be written corrupt: ${describeStoryIntegrityViolations(violations)}`,
      );
    }

    writeFileSync(file, `${JSON.stringify(written, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${slug}/${language}.`);
  }
}
