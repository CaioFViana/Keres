import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeLcovReports, parseLcov, serializeLcov } from './lib/coverage';
import { repoRoot } from './lib/packages';

/**
 * Merges the API's unit and integration lcov reports into one union report.
 *
 *   bun run api:coverage:merge
 *
 * The two suites cover the same files, so the merge keeps the highest hit count per location
 * (see `lib/coverage.ts`) instead of counting every line twice. Editors and coverage services
 * read the single `apps/api/coverage-combined/lcov.info` this writes.
 */
const reports = [
  parseLcov(repoRoot, 'apps/api', 'coverage'),
  parseLcov(repoRoot, 'apps/api', 'coverage-integration'),
];

if (reports.some((report) => report === null)) {
  console.error(
    'Both API reports are required. Run unit and integration coverage before merging them.',
  );
  process.exit(1);
}

const outputDirectory = resolve(repoRoot, 'apps/api/coverage-combined');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, 'lcov.info'),
  serializeLcov(mergeLcovReports(reports)),
  'utf8',
);
console.log('Merged API coverage written to apps/api/coverage-combined/lcov.info.');
