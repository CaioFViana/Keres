/** @jest-environment node */
import JSZip from 'jszip';
import { compileLinearManuscript } from '../../../src/components/features/manuscript/export/manuscriptCompiler';
import { buildManuscriptDocxBase64 } from '../../../src/components/features/manuscript/export/manuscriptDocx';
import type { ChapterSelect, ChoiceSelect, SceneSelect } from '../../../src/db/schema';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeChapter(overrides: Partial<ChapterSelect> = {}): ChapterSelect {
  return {
    id: 'ch-1',
    storyId: 'story-1',
    name: 'Arrival',
    index: 1,
    type: 'chapter',
    summary: null,
    isFavorite: false,
    extraNotes: null,
    arcId: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeScene(overrides: Partial<SceneSelect> = {}): SceneSelect {
  return {
    id: 's-1',
    storyId: 'story-1',
    chapterId: 'ch-1',
    locationId: null,
    name: 'Opening',
    index: 1,
    summary: null,
    body: 'First **bold** line.',
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeChoice(overrides: Partial<ChoiceSelect> = {}): ChoiceSelect {
  return {
    id: 'choice-1',
    storyId: 'story-1',
    sceneId: 's-1',
    nextSceneId: 's-2',
    text: 'Go on',
    notes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  } as ChoiceSelect;
}

function manuscript(includeLooseScenes: boolean) {
  return compileLinearManuscript({
    title: 'My Story',
    chapters: [makeChapter()],
    scenes: [
      makeScene(),
      makeScene({ id: 's-2', name: 'Next', index: 2, body: 'After.' }),
      makeScene({ id: 's-loose', name: 'Note', index: 3, chapterId: null, body: 'Aside.' }),
    ],
    choices: [makeChoice(), makeChoice({ id: 'choice-2', sceneId: 's-2', nextSceneId: 's-loose' })],
    includeLooseScenes,
    looseHeadingLabel: 'Loose',
  });
}

async function documentXml(base64: string): Promise<string> {
  const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('no document.xml in the package');
  return file.async('string');
}

function bookmarkNames(xml: string): string[] {
  return Array.from(xml.matchAll(/<w:bookmarkStart[^>]*w:name="([^"]+)"/g), (match) => match[1]);
}

function pageReferences(xml: string): string[] {
  return Array.from(xml.matchAll(/PAGEREF ([A-Za-z0-9_-]+)/g), (match) => match[1]);
}

describe('buildManuscriptDocxBase64', () => {
  it('packs a valid zip carrying the manuscript', async () => {
    const base64 = await buildManuscriptDocxBase64(manuscript(true), { goToPage: 'Go to page' });

    expect(base64.startsWith('UEsDB')).toBe(true);
    const xml = await documentXml(base64);
    expect(xml).toContain('My Story');
    expect(xml).toContain('Arrival');
    expect(xml).toContain('Opening');
    expect(xml).toContain('First ');
    expect(xml).toContain('Go on');
  });

  it('bookmarks every scene and points every choice at an existing bookmark', async () => {
    const xml = await documentXml(
      await buildManuscriptDocxBase64(manuscript(true), { goToPage: 'Go to page' }),
    );

    const bookmarks = bookmarkNames(xml);
    expect(bookmarks).toEqual(expect.arrayContaining(['scene-s1', 'scene-s2', 'scene-sloose']));
    const references = pageReferences(xml);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) expect(bookmarks).toContain(reference);
    expect(xml).toContain('Go to page');
  });

  it('renders name-only choices when the target left the export', async () => {
    const xml = await documentXml(
      await buildManuscriptDocxBase64(manuscript(false), { goToPage: 'Go to page' }),
    );

    expect(bookmarkNames(xml)).not.toContain('scene-sloose');
    // The surviving choice still references; the orphaned one degrades to its name.
    expect(pageReferences(xml)).toEqual(['scene-s2']);
    expect(xml).toContain('Note');
  });

  it('numbers pages in the footer', async () => {
    const base64 = await buildManuscriptDocxBase64(manuscript(true), { goToPage: 'Go to page' });
    const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
    const footers = zip.file(/word\/footer\d*\.xml/);
    expect(footers.length).toBeGreaterThan(0);
    const footerXml = await footers[0].async('string');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('NUMPAGES');
  });
});
