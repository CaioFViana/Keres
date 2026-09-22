import {
  buildCharacterRelationMapFileName,
  buildExportFileName,
  buildExportZipFileName,
  buildLocationGraphMapFileName,
  buildLocationMapFileName,
  buildManuscriptFileName,
  buildStoryMapFileName,
  buildStoryTimelineFileName,
  exportFileLanguage,
} from '../../src/utils/storyTransfer';

jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { localPathFor: jest.fn(), exists: jest.fn(() => false) },
}));

const DATE = new Date('2026-08-11T18:00:00.000Z');

/**
 * The file name is what the person sees in the downloads folder and what they use to find the
 * right backup months later. It has to be accepted by any file system and must not
 * collide between exports on different days.
 */
describe('export file names', () => {
  it('slugifies the title and stamps the export date', () => {
    expect(buildExportFileName('A Queda de Keres', DATE)).toBe('a-queda-de-keres-2026-08-11.json');
  });

  it('strips accents instead of leaving them in the file name', () => {
    expect(buildExportFileName('Ação e Coração', DATE)).toBe('acao-e-coracao-2026-08-11.json');
  });

  it('collapses punctuation and whitespace into single dashes', () => {
    expect(buildExportFileName('  A   Queda:  parte 2!! ', DATE)).toBe(
      'a-queda-parte-2-2026-08-11.json',
    );
  });

  it.each([
    ['only punctuation', '!!!'],
    ['only whitespace', '   '],
    ['empty', ''],
    ['non-latin script', '物語'],
  ])('falls back to "story" for a %s title', (_label, title) => {
    expect(buildExportFileName(title, DATE)).toBe('story-2026-08-11.json');
  });

  it('caps the slug so the name stays within filesystem limits', () => {
    const name = buildExportFileName('a'.repeat(200), DATE);

    expect(name).toBe(`${'a'.repeat(60)}-2026-08-11.json`);
  });

  it('never emits a character that a filesystem would reject', () => {
    const name = buildExportFileName('C:\\pasta/arquivo?<>|"*', DATE);

    expect(name).toMatch(/^[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it.each([
    ['story map', buildStoryMapFileName, 'a-queda-mapa-2026-08-11.svg'],
    ['relation map', buildCharacterRelationMapFileName, 'a-queda-relacoes-2026-08-11.svg'],
    ['location map', buildLocationGraphMapFileName, 'a-queda-locais-2026-08-11.svg'],
  ])('names the %s in Portuguese', (_label, build, expected) => {
    expect(build('A Queda', DATE, 'pt')).toBe(expected);
  });

  it('names the data package consistently with the data export', () => {
    expect(buildExportZipFileName('A Queda', DATE)).toBe('a-queda-2026-08-11.zip');
  });

  it('names the manuscript apart from the data backup', () => {
    expect(buildManuscriptFileName('A Queda', 'docx', DATE, 'pt')).toBe(
      'a-queda-manuscrito-2026-08-11.docx',
    );
    expect(buildManuscriptFileName('A Queda', 'pdf', DATE, 'pt')).toBe(
      'a-queda-manuscrito-2026-08-11.pdf',
    );
  });

  it('names the timeline and the location map drawing per language', () => {
    expect(buildStoryTimelineFileName('A Queda', DATE, 'pt')).toBe(
      'a-queda-linha-do-tempo-2026-08-11.svg',
    );
    expect(buildStoryTimelineFileName('A Queda', DATE, 'en')).toBe('a-queda-timeline-2026-08-11.svg');
    expect(buildLocationMapFileName('Atlas', DATE, 'pt')).toBe('atlas-mapa-2026-08-11.svg');
    expect(buildLocationMapFileName('Atlas', DATE, 'en')).toBe('atlas-map-2026-08-11.svg');
  });

  it.each([
    ['pt-BR', 'pt'],
    ['pt', 'pt'],
    ['en-US', 'en'],
    ['en', 'en'],
    [undefined, 'en'],
  ])('resolves the app language %s to %s file slugs', (appLanguage, expected) => {
    expect(exportFileLanguage(appLanguage)).toBe(expected);
  });

  it.each([
    ['story map', buildStoryMapFileName, 'a-queda-map-2026-08-11.svg'],
    ['relation map', buildCharacterRelationMapFileName, 'a-queda-relations-2026-08-11.svg'],
    ['location map', buildLocationGraphMapFileName, 'a-queda-locations-2026-08-11.svg'],
  ])('names the %s in English', (_label, build, expected) => {
    expect(build('A Queda', DATE, 'en')).toBe(expected);
  });

  it('names the manuscript in English', () => {
    expect(buildManuscriptFileName('A Queda', 'docx', DATE, 'en')).toBe(
      'a-queda-manuscript-2026-08-11.docx',
    );
  });

  it('defaults file slugs to English', () => {
    expect(buildManuscriptFileName('A Queda', 'docx', DATE)).toBe(
      'a-queda-manuscript-2026-08-11.docx',
    );
  });

  it('keeps exports of different days apart, so a backup never silently overwrites another', () => {
    const first = buildExportFileName('A Queda', new Date('2026-08-11T23:00:00.000Z'));
    const second = buildExportFileName('A Queda', new Date('2026-08-12T01:00:00.000Z'));

    expect(first).not.toBe(second);
  });

  it('defaults to today when no date is given', () => {
    expect(buildExportFileName('A Queda')).toMatch(/^a-queda-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
