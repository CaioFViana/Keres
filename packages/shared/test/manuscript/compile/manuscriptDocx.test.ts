import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  compileLinearManuscript,
  type ManuscriptChoice,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import { buildManuscriptDocxBytes } from '../../../manuscript/compile/export/manuscriptDocx';
import type {
  ManuscriptChapter,
  ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';

function makeChapter(overrides: Partial<ManuscriptChapter> = {}): ManuscriptChapter {
  return { id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter', ...overrides };
}

function makeScene(overrides: Partial<ManuscriptScene> = {}): ManuscriptScene {
  return {
    id: 's-1',
    chapterId: 'ch-1',
    name: 'Opening',
    index: 1,
    body: 'First **bold** and __lined__ line.',
    isDeleted: false,
    ...overrides,
  };
}

function makeChoice(overrides: Partial<ManuscriptChoice> = {}): ManuscriptChoice {
  return { id: 'choice-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Go on', ...overrides };
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

async function documentXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
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

describe('buildManuscriptDocxBytes', () => {
  it('packs a valid zip carrying the manuscript', async () => {
    const bytes = await buildManuscriptDocxBytes(manuscript(true), { goToPage: 'Go to page' });

    expect(bytes).toBeInstanceOf(Uint8Array);
    // Zip magic: `PK\x03\x04`.
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const xml = await documentXml(bytes);
    expect(xml).toContain('My Story');
    expect(xml).toContain('Arrival');
    expect(xml).toContain('Opening');
    expect(xml).toContain('First ');
    expect(xml).toContain('<w:u ');
    expect(xml).toContain('Go on');
  });

  it('bookmarks every scene and points every choice at an existing bookmark', async () => {
    const xml = await documentXml(
      await buildManuscriptDocxBytes(manuscript(true), { goToPage: 'Go to page' }),
    );

    const bookmarks = bookmarkNames(xml);
    expect(bookmarks).toEqual(expect.arrayContaining(['scene-s1', 'scene-s2', 'scene-sloose']));
    const references = pageReferences(xml);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) expect(bookmarks).toContain(reference);
    expect(xml).toContain('Go to page');
  });

  it('renders ~~ spans with strike-through runs', async () => {
    const struck = compileLinearManuscript({
      title: 'My Story',
      chapters: [makeChapter()],
      scenes: [makeScene({ body: 'A ~~cut~~ line.' })],
      choices: [],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
    });
    const xml = await documentXml(
      await buildManuscriptDocxBytes(struck, { goToPage: 'Go to page' }),
    );

    expect(xml).toContain('cut');
    expect(xml).toContain('w:strike');
  });

  it('renders name-only choices when the target left the export', async () => {
    const xml = await documentXml(
      await buildManuscriptDocxBytes(manuscript(false), { goToPage: 'Go to page' }),
    );

    expect(bookmarkNames(xml)).not.toContain('scene-sloose');
    // The surviving choice still references; the orphaned one degrades to its name.
    expect(pageReferences(xml)).toEqual(['scene-s2']);
    expect(xml).toContain('Note');
  });

  it('numbers pages in the footer', async () => {
    const bytes = await buildManuscriptDocxBytes(manuscript(true), { goToPage: 'Go to page' });
    const zip = await JSZip.loadAsync(bytes);
    const footers = zip.file(/word\/footer\d*\.xml/);
    expect(footers.length).toBeGreaterThan(0);
    const footerXml = await footers[0].async('string');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('NUMPAGES');
  });
});
