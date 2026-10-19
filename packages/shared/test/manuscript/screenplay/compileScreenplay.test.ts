import { describe, expect, it } from 'vitest';
import { compileStoryManuscript } from '../../../manuscript/compile/compileStoryManuscript';
import { ManuscriptOptionsSchema } from '../../../manuscript/compile/manuscriptContracts';
import type { CompileStoryManuscriptInput } from '../../../manuscript/compile/presentedManuscript';

const input: CompileStoryManuscriptInput = {
  storyTitle: 'The Universe',
  storyType: 'linear',
  arcs: [
    { id: 'arc-1', title: 'Pilot' },
    { id: 'arc-2', title: 'Finale' },
  ],
  chapters: [
    { id: 'ch-1', name: 'Act One', index: 1, type: 'chapter', arcId: 'arc-1' },
    { id: 'ch-2', name: 'Act Two', index: 2, type: 'chapter', arcId: 'arc-2' },
  ],
  scenes: [
    {
      id: 's-1',
      chapterId: 'ch-1',
      name: 'Kitchen',
      index: 1,
      body: 'Coffee goes cold.\n\nMOM\nBe careful.',
      isDeleted: false,
      summary: 'They plan.',
      locationName: 'Kitchen',
      locationIntExt: 'interior',
    },
    {
      id: 's-2',
      chapterId: 'ch-2',
      name: 'Roof',
      index: 1,
      body: 'EXT. ROOF - NIGHT\nWind.',
      isDeleted: false,
    },
  ],
  choices: [],
};

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('compileStoryManuscript as a screenplay', () => {
  it("compiles Fountain text with the work's title, its credit and a heading from the place", async () => {
    const compiled = await compileStoryManuscript(input, {
      format: 'fountain',
      arcId: 'arc-1',
      author: 'Ana',
    });
    const text = decode(compiled.bytes);

    expect(compiled).toMatchObject({ extension: 'fountain', mimeType: 'text/plain' });
    expect(text).toContain('Title: Pilot');
    expect(text).toContain('Credit: Written by');
    expect(text).toContain('Author: Ana');
    expect(text).toContain('INT. KITCHEN');
    expect(text).toContain('= They plan.');
    expect(text).toContain('Coffee goes cold.');
    // Only the work asked for: its sibling's scene is not in it.
    expect(text).not.toContain('Wind.');
  });

  it('credits in Portuguese when the text is', async () => {
    const compiled = await compileStoryManuscript(input, {
      format: 'fountain',
      arcId: 'arc-1',
      author: 'Ana',
      language: 'pt-BR',
    });

    expect(decode(compiled.bytes)).toContain('Credit: Escrito por');
  });

  it('writes no credit line when nobody is credited', async () => {
    const compiled = await compileStoryManuscript(input, { format: 'fountain', arcId: 'arc-1' });

    expect(decode(compiled.bytes)).not.toContain('Credit:');
  });

  it('follows the screenplay options: numbers, no generated headings, no synopses', async () => {
    const compiled = await compileStoryManuscript(input, {
      format: 'fountain',
      arcId: 'arc-2',
      screenplay: {
        numberScenes: true,
        generateHeadings: false,
        includeSynopses: false,
        includeSections: false,
      },
    });
    const text = decode(compiled.bytes);

    expect(text).toContain('EXT. ROOF - NIGHT #1#');
    expect(text).not.toContain('# Act Two');
  });

  it('compiles the industry PDF, on A4 when asked', async () => {
    const letter = await compileStoryManuscript(input, {
      format: 'screenplay-pdf',
      arcId: 'arc-1',
      author: 'Ana',
    });
    const a4 = await compileStoryManuscript(input, {
      format: 'screenplay-pdf',
      arcId: 'arc-1',
      screenplay: { paper: 'a4' },
    });
    const raw = (bytes: Uint8Array) =>
      Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

    expect(letter).toMatchObject({ extension: 'pdf', mimeType: 'application/pdf' });
    expect(raw(letter.bytes).startsWith('%PDF-1.4')).toBe(true);
    expect(raw(letter.bytes)).toContain('/MediaBox [0 0 612 792]');
    expect(raw(a4.bytes)).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('leaves loose scenes out unless asked, as every manuscript does', async () => {
    const withLoose = {
      ...input,
      scenes: [
        ...input.scenes,
        {
          id: 's-3',
          chapterId: null,
          name: 'Loose',
          index: 9,
          body: 'LOOSE TEXT.',
          isDeleted: false,
        },
      ],
    };

    const without = decode((await compileStoryManuscript(withLoose, { format: 'fountain' })).bytes);
    const asked = decode(
      (await compileStoryManuscript(withLoose, { format: 'fountain', includeLooseScenes: true }))
        .bytes,
    );

    expect(without).not.toContain('LOOSE TEXT.');
    expect(asked).toContain('LOOSE TEXT.');
  });

  it('keeps every other format on the book pipeline', async () => {
    const compiled = await compileStoryManuscript(input, { format: 'md', arcId: 'arc-1' });

    expect(compiled.extension).toBe('md');
    expect(decode(compiled.bytes)).toContain('Coffee goes cold.');
  });

  it('validates the screenplay options', () => {
    expect(
      ManuscriptOptionsSchema.parse({ format: 'fountain', screenplay: {} }).screenplay,
    ).toMatchObject({
      paper: 'letter',
      numberScenes: false,
      generateHeadings: true,
      includeSynopses: true,
      includeSections: true,
    });
    expect(() =>
      ManuscriptOptionsSchema.parse({ format: 'fountain', screenplay: { paper: 'legal' } }),
    ).toThrow();
  });
});
