import {
  buildCharacterRelationMapFileName,
  buildExportFileName,
  buildExportZipFileName,
  buildLocationGraphMapFileName,
  buildStoryMapFileName,
} from '../../src/utils/storyTransfer';

jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { localPathFor: jest.fn(), exists: jest.fn(() => false) },
}));

const DATE = new Date('2026-08-11T18:00:00.000Z');

/**
 * O nome do arquivo é o que a pessoa vê na pasta de downloads e o que ela usa para achar o
 * backup certo meses depois. Precisa ser aceito por qualquer sistema de arquivos e não pode
 * colidir entre exportações de dias diferentes.
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
    ['data package', buildExportZipFileName, 'a-queda-2026-08-11.zip'],
    ['story map', buildStoryMapFileName, 'a-queda-mapa-2026-08-11.svg'],
    ['relation map', buildCharacterRelationMapFileName, 'a-queda-relacoes-2026-08-11.svg'],
    ['location map', buildLocationGraphMapFileName, 'a-queda-locations-2026-08-11.svg'],
  ])('names the %s consistently with the data export', (_label, build, expected) => {
    expect(build('A Queda', DATE)).toBe(expected);
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
