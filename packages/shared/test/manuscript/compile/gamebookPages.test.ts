import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  compileGamebookManuscript,
  type CompiledBlock,
  type ManuscriptChoice,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import { buildManuscriptDocxBytes } from '../../../manuscript/compile/export/manuscriptDocx';
import { pdfGeometry } from '../../../manuscript/compile/export/manuscriptPdfLayout';
import {
  flattenRuns,
  paginateStream,
  type PdfAnchor,
} from '../../../manuscript/compile/export/manuscriptPdfRuns';
import type { ManuscriptScene } from '../../../manuscript/compile/manuscriptSections';

const LABELS = { goToPage: 'Go to page', sceneWord: 'scene', tocHeading: 'Contents' };

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

const gamebook = (options: { showSceneNames?: boolean; scenePerPage?: boolean } = {}) =>
  compileGamebookManuscript({
    title: 'My Book',
    scenes,
    choices,
    order: 'discovery',
    showSceneNames: options.showSceneNames ?? false,
    scenePerPage: options.scenePerPage,
    endLabel: 'the end of this excerpt',
    startLabels: { choose: 'Choose where to begin', begin: 'Begin' },
  });

type Gamebook = ReturnType<typeof gamebook>;

/** The page every scene landed on, and the lines of the PDF, as it lays them out. */
function layoutOf(manuscript: Gamebook, labels: typeof LABELS = LABELS) {
  const firstPass = paginateStream(
    flattenRuns(manuscript, labels, new Map(), {}),
    pdfGeometry({}),
    () => undefined,
  );
  const anchors: Map<string, PdfAnchor> = firstPass.anchors;
  const lines = flattenRuns(manuscript, labels, anchors, {}).map((run) =>
    run.words.map((word) => word.text).join(' '),
  );
  return { anchors, lines, pages: firstPass.pageCount };
}

const sceneHeadings = (manuscript: Gamebook) =>
  manuscript.blocks.filter(
    (block): block is Extract<CompiledBlock, { kind: 'scene-heading' }> =>
      block.kind === 'scene-heading',
  );
const pageOf = (manuscript: Gamebook, anchors: Map<string, PdfAnchor>, id: string) =>
  anchors.get(sceneHeadings(manuscript).find((entry) => entry.id === id)!.bookmarkId!)?.page;

describe('a gamebook choice in the PDF', () => {
  it('names the page and the scene, so scenes that share a page can still be told apart', () => {
    const manuscript = gamebook();
    const { anchors, lines } = layoutOf(manuscript);

    // The three short scenes run on, all on page 1: the page alone would send the reader nowhere in particular.
    expect([pageOf(manuscript, anchors, 's-b'), pageOf(manuscript, anchors, 's-c')]).toEqual([
      1, 1,
    ]);
    expect(lines).toContain('• Knock — Go to page 1, scene 2');
    expect(lines).toContain('• Climb — Go to page 1, scene 3');
    expect(lines).toContain('• Go on — Go to page 1, scene 3');
  });

  it('adds the name of the scene in brackets when the book shows names', () => {
    const { lines } = layoutOf(gamebook({ showSceneNames: true }));

    expect(lines).toContain('• Climb — Go to page 1, scene 3 (Gamma)');
  });

  it('says the scene in the words it is given', () => {
    const { lines } = layoutOf(gamebook(), {
      goToPage: 'Vá para a página',
      sceneWord: 'cena',
      tocHeading: 'Índice',
    });

    expect(lines).toContain('• Climb — Vá para a página 1, cena 3');
  });

  it('leaves the scenes running on by default', () => {
    expect(layoutOf(gamebook()).pages).toBe(1);
    expect(sceneHeadings(gamebook()).some((heading) => heading.ownPage)).toBe(false);
  });
});

describe('a gamebook with one scene per page', () => {
  it('opens a page for each scene, the first staying on the page of the title', () => {
    const manuscript = gamebook({ scenePerPage: true });
    const { anchors } = layoutOf(manuscript);

    expect(['s-a', 's-b', 's-c'].map((id) => pageOf(manuscript, anchors, id))).toEqual([1, 2, 3]);
  });

  it('points every choice at the page of its scene, and still names the scene', () => {
    const { lines } = layoutOf(gamebook({ scenePerPage: true }));

    expect(lines).toContain('• Knock — Go to page 2, scene 2');
    expect(lines).toContain('• Climb — Go to page 3, scene 3');
  });

  it('marks the scenes as opening a page of their own', () => {
    expect(
      sceneHeadings(gamebook({ scenePerPage: true })).every((heading) => heading.ownPage === true),
    ).toBe(true);
  });
});

describe('a gamebook in a Word document', () => {
  const docx = async (scenePerPage: boolean) => {
    const bytes = await buildManuscriptDocxBytes(gamebook({ scenePerPage }), {
      goToPage: 'Go to page',
      sceneWord: 'scene',
      tocHeading: 'Contents',
    });
    const zip = await JSZip.loadAsync(bytes);
    return zip.file('word/document.xml')!.async('string');
  };

  it('starts each scene but the first on a new page when asked to', async () => {
    expect(((await docx(true)).match(/<w:pageBreakBefore\/>/g) ?? []).length).toBe(2);
    expect(((await docx(false)).match(/<w:pageBreakBefore\/>/g) ?? []).length).toBe(0);
  });

  it('ends a choice with the scene beside the page the field gives', async () => {
    const xml = await docx(false);

    expect(xml).toContain(', scene 2');
    expect(xml).toContain(', scene 3');
  });
});
