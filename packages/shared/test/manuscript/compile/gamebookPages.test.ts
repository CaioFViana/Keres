import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildManuscriptDocxBytes } from '../../../manuscript/compile/export/manuscriptDocx';
import {
  compileGamebookManuscript,
  type CompiledBlock,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import { pdfGeometry } from '../../../manuscript/compile/export/manuscriptPdfLayout';
import {
  flattenRuns,
  paginateStream,
  type PdfAnchor,
} from '../../../manuscript/compile/export/manuscriptPdfRuns';
import type { ManuscriptChoice } from '../../../manuscript/compile/export/manuscriptCompiler';
import type { ManuscriptScene } from '../../../manuscript/compile/manuscriptSections';

const LABELS = { goToPage: 'Go to page', tocHeading: 'Contents' };

const scene = (id: string, name: string, index: number, isStart = false): ManuscriptScene => ({
  id,
  chapterId: null,
  name,
  index,
  body: `${name} is short: a line or two, nowhere near a page.`,
  isDeleted: false,
  ...(isStart ? { isStart } : {}),
});
const choice = (id: string, from: string, to: string, text: string): ManuscriptChoice =>
  ({ id, sceneId: from, nextSceneId: to, text }) as ManuscriptChoice;

const scenes = [scene('s-a', 'Alpha', 1, true), scene('s-b', 'Beta', 2), scene('s-c', 'Gamma', 3)];
const choices = [
  choice('c-1', 's-a', 's-b', 'Knock'),
  choice('c-2', 's-a', 's-c', 'Climb'),
  choice('c-3', 's-b', 's-c', 'Go on'),
];

const gamebook = (showSceneNames: boolean) =>
  compileGamebookManuscript({
    title: 'My Book',
    scenes,
    choices,
    order: 'discovery',
    showSceneNames,
    endLabel: 'the end of this excerpt',
    startLabels: { choose: 'Choose where to begin', begin: 'Begin' },
  });

/** The page every scene landed on, and the page each choice line points to, as the PDF lays them out. */
function layoutOf(manuscript: ReturnType<typeof gamebook>) {
  const geometry = pdfGeometry({});
  const firstPass = paginateStream(
    flattenRuns(manuscript, LABELS, new Map(), {}),
    geometry,
    () => undefined,
  );
  const anchors: Map<string, PdfAnchor> = firstPass.anchors;
  const lines = flattenRuns(manuscript, LABELS, anchors, {}).map((run) =>
    run.words.map((word) => word.text).join(' '),
  );
  return { anchors, lines, pages: firstPass.pageCount };
}

const sceneHeadings = (manuscript: ReturnType<typeof gamebook>) =>
  manuscript.blocks.filter(
    (block): block is Extract<CompiledBlock, { kind: 'scene-heading' }> =>
      block.kind === 'scene-heading',
  );

describe('a gamebook in the paged formats', () => {
  it('opens a page for each scene, which is what lets a choice say which page to go to', () => {
    for (const showSceneNames of [false, true]) {
      const manuscript = gamebook(showSceneNames);
      const { anchors } = layoutOf(manuscript);

      const pages = sceneHeadings(manuscript).map(
        (heading) => anchors.get(heading.bookmarkId!)?.page,
      );

      expect(pages).toHaveLength(3);
      expect(new Set(pages).size).toBe(3);
    }
  });

  it('keeps the first scene on the title page and takes the others to their own', () => {
    const manuscript = gamebook(false);
    const { anchors } = layoutOf(manuscript);

    const [first, second, third] = sceneHeadings(manuscript).map(
      (heading) => anchors.get(heading.bookmarkId!)?.page,
    );

    expect([first, second, third]).toEqual([1, 2, 3]);
  });

  it('points every choice at the page its scene is on, with no two scenes sharing a page number', () => {
    const manuscript = gamebook(false);
    const { anchors, lines } = layoutOf(manuscript);
    const pageOf = (id: string) => {
      const heading = sceneHeadings(manuscript).find((entry) => entry.id === id);
      return anchors.get(heading!.bookmarkId!)?.page;
    };

    expect(lines).toContain(`• Knock — Go to page ${pageOf('s-b')}`);
    expect(lines).toContain(`• Climb — Go to page ${pageOf('s-c')}`);
    expect(lines).toContain(`• Go on — Go to page ${pageOf('s-c')}`);
    expect(pageOf('s-b')).not.toBe(pageOf('s-c'));
  });

  it('marks the scenes of a gamebook, and no others, as opening a page of their own', () => {
    expect(sceneHeadings(gamebook(false)).every((heading) => heading.ownPage === true)).toBe(true);
  });
});

describe('a gamebook in a Word document', () => {
  it('starts each scene but the first on a new page, so the page its choices cite is one scene', async () => {
    const bytes = await buildManuscriptDocxBytes(gamebook(false), {
      goToPage: 'Go to page',
      tocHeading: 'Contents',
    });
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file('word/document.xml')!.async('string');

    // Three scene headings; the first follows the title, the other two open pages.
    expect((xml.match(/<w:pageBreakBefore\/>/g) ?? []).length).toBe(2);
  });
});
