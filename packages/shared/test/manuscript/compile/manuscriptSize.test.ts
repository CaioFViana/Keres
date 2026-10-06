import { describe, expect, it } from 'vitest';
import { compileStoryManuscript } from '../../../manuscript/compile/compileStoryManuscript';
import {
  MAX_MANUSCRIPT_BYTES,
  type ManuscriptFormat,
} from '../../../manuscript/compile/manuscriptContracts';
import {
  MANUSCRIPT_SIZE_NEAR_RATIO,
  assertWithinManuscriptLimit,
  assessManuscriptSize,
  estimateManuscriptBytes,
  manuscriptSizeAssessment,
  utf8ByteLength,
  type SizedFormat,
} from '../../../manuscript/compile/manuscriptSize';
import { compileStoryReader } from '../../../manuscript/reader/storyReader';
import { encodePng } from '../images/imageFixtures';

describe('utf8ByteLength', () => {
  it('counts the bytes of ascii, accents, other scripts and emoji like the encoder does', () => {
    const encoder = new TextEncoder();
    for (const text of [
      '',
      'plain',
      'café ñ ç',
      '日本語のテキスト',
      'emoji 😀 and more 🎉',
      'a\u0000b',
    ]) {
      expect(utf8ByteLength(text), text).toBe(encoder.encode(text).length);
    }
  });
});

describe('assessManuscriptSize', () => {
  it('says ok, near and over against the limit', () => {
    const limit = 1000;

    expect(assessManuscriptSize(500, limit).status).toBe('ok');
    expect(assessManuscriptSize(limit * MANUSCRIPT_SIZE_NEAR_RATIO, limit).status).toBe('near');
    expect(assessManuscriptSize(limit, limit).status).toBe('near');
    expect(assessManuscriptSize(limit + 1, limit).status).toBe('over');
    expect(assessManuscriptSize(1200, limit)).toMatchObject({ remaining: -200, ratio: 1.2 });
  });

  it("judges against the pipeline's own limit by default", () => {
    expect(assessManuscriptSize(0).limit).toBe(MAX_MANUSCRIPT_BYTES);
    expect(manuscriptSizeAssessment({ format: 'md', textBytes: 100 }).status).toBe('ok');
  });
});

describe('estimateManuscriptBytes', () => {
  it('counts images exactly, with a third more when they travel as text, and none where they cannot go', () => {
    const images = [3000, 6000];
    const docx = estimateManuscriptBytes({ format: 'docx', textBytes: 0, imageBytes: images });
    const noImages = estimateManuscriptBytes({ format: 'docx', textBytes: 0 });
    const html = estimateManuscriptBytes({ format: 'html', textBytes: 0, imageBytes: images });
    const htmlBare = estimateManuscriptBytes({ format: 'html', textBytes: 0 });

    expect(docx - noImages).toBe(9000 + 2 * 1024);
    expect(html - htmlBare).toBe(4000 + 8000 + 2 * 1024);
    for (const format of ['md', 'txt', 'fountain', 'screenplay-pdf'] as const) {
      expect(estimateManuscriptBytes({ format, textBytes: 10, imageBytes: [999_999] })).toBe(
        estimateManuscriptBytes({ format, textBytes: 10 }),
      );
    }
  });

  it('grows with the text', () => {
    for (const format of ['docx', 'pdf', 'epub', 'html', 'md', 'txt', 'reader'] as const) {
      expect(estimateManuscriptBytes({ format, textBytes: 2_000_000 }), format).toBeGreaterThan(
        estimateManuscriptBytes({ format, textBytes: 1_000_000 }),
      );
    }
  });

  it('is never lower than the real file, in any format, for prose that does not compress away', async () => {
    // Pseudo-random words from a vocabulary: far less compressible than a repeated sentence.
    let seed = 12345;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    const vocabulary = Array.from({ length: 3000 }, () =>
      Array.from({ length: 3 + (next() % 8) }, () => String.fromCharCode(97 + (next() % 26))).join(
        '',
      ),
    );
    const prose = (words: number) =>
      Array.from({ length: words }, () => vocabulary[next() % vocabulary.length]).join(' ');
    const input = {
      storyTitle: 'Sizes',
      storyType: 'linear' as const,
      chapters: [{ id: 'c', name: 'One', index: 1, type: 'chapter' as const, arcId: null }],
      scenes: Array.from({ length: 60 }, (_, index) => ({
        id: `s${index}`,
        chapterId: 'c',
        name: `Scene ${index}`,
        index: index + 1,
        body: prose(900),
        isDeleted: false,
      })),
      choices: [],
    };
    const textBytes = input.scenes.reduce((sum, scene) => sum + utf8ByteLength(scene.body), 0);

    const formats: ManuscriptFormat[] = ['docx', 'pdf', 'epub', 'html', 'md', 'txt', 'fountain'];
    for (const format of formats) {
      const compiled = await compileStoryManuscript(input, { format, includeSceneNames: true });
      const estimate = estimateManuscriptBytes({ format, textBytes });
      expect(
        estimate,
        `${format}: estimate ${estimate} vs real ${compiled.bytes.length}`,
      ).toBeGreaterThanOrEqual(compiled.bytes.length);
      // And not wildly above it either: a tenfold overestimate would cry wolf.
      expect(estimate, format).toBeLessThan(compiled.bytes.length * 6 + 400_000);
    }
    const reader = compileStoryReader(input as never, {} as never).bytes.length;
    expect(
      estimateManuscriptBytes({ format: 'reader' as SizedFormat, textBytes }),
    ).toBeGreaterThanOrEqual(reader);
  });

  it('is never lower than the real file with page pictures in it, even ones that do not compress', async () => {
    let seed = 99;
    const noise = (length: number) =>
      Array.from({ length }, () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed >> 8) & 255;
      });
    const width = 120;
    const height = 160;
    const rows = Array.from({ length: height }, () => noise(width * 4));
    const png = {
      bytes: encodePng({ width, height, colorType: 6, rows }),
      mimeType: 'image/png' as const,
      width,
      height,
    };
    const pages = Array.from({ length: 4 }, (_, index) => ({
      id: `p${index}`,
      mediaId: 'noise',
      fit: 'contain' as const,
      text: 'A caption.',
    }));
    const input = {
      storyTitle: 'Pictures',
      storyType: 'linear' as const,
      chapters: [{ id: 'c', name: 'One', index: 1, type: 'chapter' as const, arcId: null }],
      scenes: [
        { id: 's', chapterId: 'c', name: 'S', index: 1, body: null, isDeleted: false, pages },
      ],
      choices: [],
      media: { noise: png },
    };

    for (const format of ['docx', 'pdf', 'epub', 'html'] as const) {
      const compiled = await compileStoryManuscript(input, { format });
      // The same picture is embedded once however many pages show it, in every format but a single HTML.
      const copies = format === 'html' ? pages.length : 1;
      const estimate = estimateManuscriptBytes({
        format,
        textBytes: 200,
        imageBytes: Array.from({ length: copies }, () => png.bytes.length),
      });
      expect(
        estimate,
        `${format}: estimate ${estimate} vs real ${compiled.bytes.length}`,
      ).toBeGreaterThanOrEqual(compiled.bytes.length);
    }
  });
});

describe('assertWithinManuscriptLimit', () => {
  it('lets a writer carry on up to the limit and stops it past it, in the words every compiler uses', () => {
    expect(() => assertWithinManuscriptLimit(100, 100)).not.toThrow();
    expect(() => assertWithinManuscriptLimit(101, 100)).toThrow(/exceeds the 100-byte limit/);
    // The API turns exactly this pattern into a 400, not a 500.
    try {
      assertWithinManuscriptLimit(MAX_MANUSCRIPT_BYTES + 1);
    } catch (error) {
      expect((error as Error).message).toMatch(/exceeds the .* limit/);
    }
  });
});
