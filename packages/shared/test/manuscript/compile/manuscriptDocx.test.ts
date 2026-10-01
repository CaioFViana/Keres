import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  compileLinearManuscript,
  type CompiledManuscript,
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

async function settingsXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file('word/settings.xml');
  if (!file) throw new Error('no settings.xml in the package');
  return file.async('string');
}

describe('buildManuscriptDocxBytes', () => {
  it('packs a valid zip carrying the manuscript', async () => {
    const bytes = await buildManuscriptDocxBytes(manuscript(true), {
      goToPage: 'Go to page',
      tocHeading: 'Contents',
    });

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
      await buildManuscriptDocxBytes(manuscript(true), {
        goToPage: 'Go to page',
        tocHeading: 'Contents',
      }),
    );

    const bookmarks = bookmarkNames(xml);
    expect(bookmarks).toEqual(expect.arrayContaining(['scene-s1', 'scene-s2', 'scene-sloose']));
    const references = pageReferences(xml);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) expect(bookmarks).toContain(reference);
    expect(xml).toContain('Go to page');
  });

  it('renders choice requirements and effects as indented paragraphs', async () => {
    const annotated = compileLinearManuscript({
      title: 'My Story',
      chapters: [makeChapter()],
      scenes: [makeScene(), makeScene({ id: 's-2', name: 'Next', index: 2, body: 'After.' })],
      choices: [
        makeChoice({
          requirements: ['Requires all of:', '• Requires the Brass Key'],
          effects: ['Effects', '• Gain the Rusty Key'],
        }),
      ],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
    });
    const xml = await documentXml(
      await buildManuscriptDocxBytes(annotated, { goToPage: 'Go to page', tocHeading: 'Contents' }),
    );

    expect(xml).toContain('Go on');
    expect(xml).toContain('Requires all of:');
    expect(xml).toContain('Requires the Brass Key');
    expect(xml).toContain('Gain the Rusty Key');
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
      await buildManuscriptDocxBytes(struck, { goToPage: 'Go to page', tocHeading: 'Contents' }),
    );

    expect(xml).toContain('cut');
    expect(xml).toContain('w:strike');
  });

  it('renders name-only choices when the target left the export', async () => {
    const xml = await documentXml(
      await buildManuscriptDocxBytes(manuscript(false), {
        goToPage: 'Go to page',
        tocHeading: 'Contents',
      }),
    );

    expect(bookmarkNames(xml)).not.toContain('scene-sloose');
    // The surviving choice still references; the orphaned one degrades to its name.
    expect(pageReferences(xml)).toEqual(['scene-s2']);
    expect(xml).toContain('Note');
  });

  it('renders a clickable index when enabled', async () => {
    const xml = await documentXml(
      await buildManuscriptDocxBytes(
        manuscript(true),
        { goToPage: 'Go to page', tocHeading: 'Contents' },
        { includeToc: true },
      ),
    );

    expect(xml).toContain('Contents');
    const hyperlinks = Array.from(
      xml.matchAll(/<w:hyperlink[^>]*w:anchor="([^"]+)"/g),
      (match) => match[1],
    );
    expect(hyperlinks).toEqual(
      expect.arrayContaining(['chapter-ch1', 'scene-s1', 'scene-s2', 'appendix', 'scene-sloose']),
    );
    const references = pageReferences(xml);
    expect(references).toEqual(
      expect.arrayContaining(['chapter-ch1', 'scene-s1', 'scene-s2', 'appendix', 'scene-sloose']),
    );
    const bookmarks = bookmarkNames(xml);
    for (const reference of references) expect(bookmarks).toContain(reference);
    expect(xml).toContain('w:leader="dot"');
    expect(xml).toContain('<w:br w:type="page"/>');
  });

  it('renders index leaders as tab runs and asks readers to resolve page numbers', async () => {
    const bytes = await buildManuscriptDocxBytes(
      manuscript(true),
      { goToPage: 'Go to page', tocHeading: 'Contents' },
      { includeToc: true },
    );
    const xml = await documentXml(bytes);

    // A bare <w:tab/> under <w:p> is invalid: readers drop it with the dots.
    expect(xml).toContain('<w:r><w:tab/></w:r>');
    expect(xml).not.toContain('</w:hyperlink><w:tab/>');
    // PAGEREF fields carry no cached result: without updateFields the numbers
    // stay blank until the user refreshes them by hand.
    expect(await settingsXml(bytes)).toContain('w:updateFields');
  });

  it('omits the index and chapter bookmarks unless enabled', async () => {
    const xml = await documentXml(
      await buildManuscriptDocxBytes(manuscript(true), {
        goToPage: 'Go to page',
        tocHeading: 'Contents',
      }),
    );

    expect(xml).not.toContain('Contents');
    expect(xml).not.toContain('w:anchor="chapter-');
    expect(xml).not.toContain('w:anchor="appendix"');
    expect(pageReferences(xml)).not.toContain('chapter-ch1');
    expect(bookmarkNames(xml)).not.toContain('chapter-ch1');
    expect(bookmarkNames(xml)).not.toContain('appendix');
    expect(bookmarkNames(xml)).toEqual(expect.arrayContaining(['scene-s1']));
    expect(xml).not.toContain('<w:br w:type="page"/>');
  });

  it('renders underline and strikethrough runs', async () => {
    const marked = {
      title: 'My Story',
      blocks: [
        { kind: 'title', text: 'My Story' },
        {
          kind: 'paragraph',
          spans: [
            { text: 'under', bold: false, italic: false, underline: true, strikethrough: false },
            { text: 'struck', bold: false, italic: false, underline: false, strikethrough: true },
          ],
        },
      ],
    } as unknown as CompiledManuscript;
    const xml = await documentXml(
      await buildManuscriptDocxBytes(marked, { goToPage: 'Go to page', tocHeading: 'Contents' }),
    );

    expect(xml).toContain('<w:u ');
    expect(xml).toContain('w:strike');
  });

  it('numbers pages in the footer', async () => {
    const bytes = await buildManuscriptDocxBytes(manuscript(true), {
      goToPage: 'Go to page',
      tocHeading: 'Contents',
    });
    const zip = await JSZip.loadAsync(bytes);
    const footers = zip.file(/word\/footer\d*\.xml/);
    expect(footers.length).toBeGreaterThan(0);
    const footerXml = await footers[0].async('string');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('NUMPAGES');
  });
});
