import { describe, expect, it } from 'vitest';
import { compileStoryManuscript } from '../../../manuscript/compile/compileStoryManuscript';
import { estimateManuscriptPages } from '../../../manuscript/compile/export/manuscriptPdf';
import { presentedManuscriptOf } from '../../../manuscript/compile/presentedManuscript';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  ManuscriptOptionsSchema,
} from '../../../manuscript/compile/manuscriptContracts';
import { renderOptionsOf } from '../../../manuscript/compile/manuscriptStyle';

const prose = (words: number) =>
  Array.from({ length: words }, (_, index) => `word${index % 97}`).join(' ');

const input = (scenesWords: number[]) => ({
  storyTitle: 'Book',
  storyType: 'linear' as const,
  chapters: [{ id: 'c', name: 'One', index: 1, type: 'chapter' as const }],
  scenes: scenesWords.map((words, index) => ({
    id: `s${index}`,
    chapterId: 'c',
    name: `S${index}`,
    index: index + 1,
    body: prose(words),
    isDeleted: false,
  })),
  choices: [],
});

const labels = { goToPage: 'Go to page', tocHeading: 'Contents' };

function estimate(options: Record<string, unknown>, words = [1500, 1500]) {
  const parsed = ManuscriptOptionsSchema.parse({ format: 'pdf', ...options });
  const presented = presentedManuscriptOf(input(words), parsed, DEFAULT_MANUSCRIPT_LABELS);
  return estimateManuscriptPages(
    presented,
    labels,
    renderOptionsOf(parsed.style, parsed.includeToc),
  );
}

const pagesOfPdf = async (options: Record<string, unknown>) => {
  const { bytes } = await compileStoryManuscript(input([1500, 1500]), {
    format: 'pdf',
    ...options,
  });
  return (new TextDecoder('latin1').decode(bytes).match(/\/Type \/Page /g) ?? []).length;
};

describe('estimateManuscriptPages', () => {
  it('counts the pages the PDF will have, by the same layout', async () => {
    expect(estimate({}).pages).toBe(await pagesOfPdf({}));
    const style = { style: { pageSize: '6x9', fontSize: 11, lineSpacing: 1.35 } };
    expect(estimate(style).pages).toBe(await pagesOfPdf(style));
  });

  it('says the page it counted on', () => {
    expect(estimate({})).toMatchObject({ pageSize: 'a4', fontSize: 11, lineSpacing: 1.5 });
    expect(estimate({ style: { pageSize: '6x9', fontSize: 12, lineSpacing: 2 } })).toMatchObject({
      pageSize: '6x9',
      fontSize: 12,
      lineSpacing: 2,
      marginPt: 54,
    });
  });

  it('grows with the text and with the leading, and shrinks on a bigger page', () => {
    const short = estimate({}, [300]).pages;
    const long = estimate({}, [6000]).pages;
    const doubleSpaced = estimate({ style: { lineSpacing: 2 } }, [6000]).pages;
    const a4 = estimate({}, [6000]).pages;
    const small = estimate({ style: { pageSize: '6x9' } }, [6000]).pages;

    expect(long).toBeGreaterThan(short);
    expect(doubleSpaced).toBeGreaterThan(long);
    expect(small).toBeGreaterThan(a4);
  });

  it('reports no first-line indent for block paragraphs', () => {
    expect(estimate({ style: { paragraphStyle: 'block' } }).firstLineIndentPt).toBe(0);
    expect(estimate({ style: { paragraphStyle: 'indent' } }).firstLineIndentPt).toBeGreaterThan(0);
  });
});
