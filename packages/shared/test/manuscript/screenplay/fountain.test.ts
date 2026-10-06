import { describe, expect, it } from 'vitest';
import {
  compileFountain,
  fountainFromBody,
  headingFromLocation,
  looksLikeCue,
  isFountainSceneHeading,
  sceneHeadingPlan,
  startsWithSceneHeading,
  withSceneNumber,
  type FountainScene,
} from '../../../manuscript/screenplay/fountain';
import type { ManuscriptChapter } from '../../../manuscript/compile/manuscriptSections';

const chapter = (id: string, name: string, index: number, arcId: string | null = null) =>
  ({ id, name, index, type: 'chapter', arcId }) as ManuscriptChapter;

const scene = (
  id: string,
  index: number,
  overrides: Partial<FountainScene> = {},
): FountainScene => ({
  id,
  chapterId: 'ch-1',
  name: `Scene ${id}`,
  index,
  body: null,
  isDeleted: false,
  ...overrides,
});

describe('scene headings', () => {
  it('knows what Fountain accepts as a heading', () => {
    for (const heading of [
      'INT. KITCHEN - DAY',
      'EXT KITCHEN',
      'ext. garden',
      'EST. CITY',
      'INT./EXT. CAR',
      'INT/EXT CAR',
      'I/E. CAR',
      '.A FORCED HEADING',
    ]) {
      expect(isFountainSceneHeading(heading), heading).toBe(true);
    }
    for (const notHeading of ['INTERIOR. KITCHEN', 'Interrogation', '...and then', 'MOM', '']) {
      expect(isFountainSceneHeading(notHeading), notHeading).toBe(false);
    }
  });

  it('looks at the first line that says anything', () => {
    expect(startsWithSceneHeading('\n\n  INT. KITCHEN\nShe waits.')).toBe(true);
    expect(startsWithSceneHeading('She waits.\nINT. KITCHEN')).toBe(false);
    expect(startsWithSceneHeading(null)).toBe(false);
    expect(startsWithSceneHeading('   \n  ')).toBe(false);
  });

  it('writes a heading from a location, forcing it when there is no interior or exterior', () => {
    expect(headingFromLocation({ name: 'Kitchen', intExt: 'interior' })).toBe('INT. KITCHEN');
    expect(headingFromLocation({ name: 'Back  yard', intExt: 'exterior' })).toBe('EXT. BACK YARD');
    expect(headingFromLocation({ name: 'Car', intExt: 'both' })).toBe('INT./EXT. CAR');
    expect(headingFromLocation({ name: 'The Void', intExt: null })).toBe('.THE VOID');
    expect(headingFromLocation({ name: '   ', intExt: 'interior' })).toBeNull();
    expect(headingFromLocation(null)).toBeNull();
  });

  it("lets the writer's own heading win over a generated one", () => {
    const place = { name: 'Kitchen', intExt: 'interior' as const };
    expect(sceneHeadingPlan({ body: 'INT. CELLAR - NIGHT\nDark.', location: place })).toEqual({
      source: 'body',
      heading: 'INT. CELLAR - NIGHT',
    });
    expect(sceneHeadingPlan({ body: 'Dark.', location: place })).toEqual({
      source: 'location',
      heading: 'INT. KITCHEN',
    });
    expect(sceneHeadingPlan({ body: 'Dark.', location: null })).toEqual({
      source: 'none',
      heading: null,
    });
  });

  it('numbers a heading once', () => {
    expect(withSceneNumber('INT. KITCHEN', 3)).toBe('INT. KITCHEN #3#');
    expect(withSceneNumber('INT. KITCHEN #1A#', 3)).toBe('INT. KITCHEN #1A#');
  });
});

describe('compileFountain', () => {
  const chapters = [chapter('ch-1', 'Act One', 1), chapter('ch-2', 'Act Two', 2)];

  it('assembles a title page, sections, headings, synopses and the text as typed', () => {
    const result = compileFountain(
      {
        title: 'The Heist',
        chapters,
        scenes: [
          scene('a', 1, {
            summary: 'They plan\nthe job.',
            location: { name: 'Kitchen', intExt: 'interior' },
            body: 'Coffee goes cold.\n\nMOM\nBe careful.',
          }),
          scene('b', 1, { chapterId: 'ch-2', body: 'EXT. ROOF - NIGHT\nWind.' }),
        ],
      },
      { titlePage: { credit: 'Written by', author: 'Ana', contact: 'a@b.c\nStreet 1' } },
    );

    expect(result.text).toBe(
      [
        'Title: The Heist',
        'Credit: Written by',
        'Author: Ana',
        'Contact:',
        '    a@b.c',
        '    Street 1',
        '',
        '# Act One',
        '',
        'INT. KITCHEN',
        '',
        '= They plan the job.',
        '',
        'Coffee goes cold.',
        '',
        'MOM',
        'Be careful.',
        '',
        '# Act Two',
        '',
        'EXT. ROOF - NIGHT',
        'Wind.',
        '',
      ].join('\n'),
    );
    expect(result).toMatchObject({ sceneCount: 2, generatedHeadings: 1 });
  });

  it("numbers the headings, the writer's own and the generated ones, in reading order", () => {
    const { text } = compileFountain(
      {
        title: 'X',
        chapters,
        scenes: [
          scene('a', 1, { location: { name: 'Kitchen', intExt: 'interior' }, body: 'One.' }),
          scene('b', 2, { body: 'EXT. ROOF\nTwo.' }),
          scene('c', 3, { body: 'INT. CELLAR #7#\nThree.' }),
        ],
      },
      { titlePage: false, includeSections: false, numberScenes: true },
    );

    expect(text).toContain('INT. KITCHEN #1#');
    expect(text).toContain('EXT. ROOF #2#');
    expect(text).toContain('INT. CELLAR #7#');
    expect(text).not.toContain('#3#');
  });

  it("carries the writer's text as the editor stores it and never doubles a heading", () => {
    const { text, generatedHeadings } = compileFountain(
      {
        title: 'X',
        chapters,
        scenes: [
          scene('a', 1, {
            location: { name: 'Kitchen', intExt: 'interior' },
            body: 'INT. CELLAR\n\n  Indented action.\r\n\r\nSAM\n(whispering)\nHello.',
          }),
        ],
      },
      { titlePage: false },
    );

    expect(generatedHeadings).toBe(0);
    expect(text).toBe(
      '# Act One\n\nINT. CELLAR\n\nIndented action.\n\nSAM\n(whispering)\nHello.\n',
    );
  });

  it('can leave generated headings, sections and synopses out', () => {
    const { text } = compileFountain(
      {
        title: 'X',
        chapters,
        scenes: [
          scene('a', 1, {
            summary: 'S',
            location: { name: 'Kitchen', intExt: 'interior' },
            body: 'Text.',
          }),
        ],
      },
      { titlePage: false, generateHeadings: false, includeSections: false, includeSynopses: false },
    );

    expect(text).toBe('Text.\n');
  });

  it("leaves out loose scenes unless asked, and a work's siblings always", () => {
    const scenes = [
      scene('a', 1, { body: 'Filed.' }),
      scene('loose', 1, { chapterId: null, body: 'Loose.' }),
      scene('other', 1, { chapterId: 'ch-2', body: 'Elsewhere.' }),
    ];
    const arcChapters = [chapter('ch-1', 'One', 1, 'arc-1'), chapter('ch-2', 'Two', 2, 'arc-2')];

    const arcOnly = compileFountain(
      { title: 'X', chapters: arcChapters, scenes },
      { titlePage: false, arcId: 'arc-1' },
    ).text;
    expect(arcOnly).toContain('Filed.');
    expect(arcOnly).not.toContain('Loose.');
    expect(arcOnly).not.toContain('Elsewhere.');

    const withLoose = compileFountain(
      { title: 'X', chapters: arcChapters, scenes },
      { titlePage: false, arcId: 'arc-1', includeLooseScenes: true },
    ).text;
    expect(withLoose).toContain('Loose.');
  });

  it('skips deleted scenes and falls back to the story title on the title page', () => {
    const { text, sceneCount } = compileFountain(
      {
        title: 'Fallback',
        chapters,
        scenes: [
          scene('a', 1, { body: 'Gone.', isDeleted: true }),
          scene('b', 2, { body: 'Kept.' }),
        ],
      },
      {},
    );

    expect(sceneCount).toBe(1);
    expect(text.startsWith('Title: Fallback\n')).toBe(true);
    expect(text).not.toContain('Gone.');
  });

  it('keeps a scene with a place and no text as a bare heading, so the outline survives', () => {
    const { text } = compileFountain(
      {
        title: 'X',
        chapters,
        scenes: [scene('a', 1, { location: { name: 'Kitchen', intExt: 'exterior' } })],
      },
      { titlePage: false, includeSections: false },
    );

    expect(text).toBe('EXT. KITCHEN\n');
  });
});

describe('fountainFromBody', () => {
  it("turns the editor's marks into Fountain's: bold, italic, underline, and no strikethrough", () => {
    expect(fountainFromBody('**bold** *slant* __under__ ~~gone~~ plain')).toBe(
      '**bold** *slant* _under_ gone plain',
    );
  });

  it('keeps a literal asterisk or underscore literal', () => {
    expect(fountainFromBody('2 \\* 3 and snake\\_case')).toBe('2 \\* 3 and snake\\_case');
  });

  it('keeps a speech with its cue: each Enter in the editor starts a paragraph', () => {
    // Paragraphs are separated by a blank line in the stored text; the speech belongs under its cue.
    expect(fountainFromBody('MOM\n\nBe careful.\n\nShe leaves.')).toBe(
      'MOM\nBe careful.\n\nShe leaves.',
    );
  });

  it('keeps parentheticals between the cue and the speech', () => {
    expect(fountainFromBody('MOM\n\n(softly)\n\nBe careful.\n\nAction.')).toBe(
      'MOM\n(softly)\nBe careful.\n\nAction.',
    );
  });

  it('leaves a speech with soft line breaks as it is', () => {
    expect(fountainFromBody('MOM\nBe careful.\nPlease.')).toBe('MOM\nBe careful.\nPlease.');
  });

  it('ends a speech at a blank paragraph, so the next one is action', () => {
    expect(fountainFromBody('MOM\n\n\n\nShe leaves.')).toBe('MOM\n\nShe leaves.');
  });

  it('does not take a heading or a transition for a name', () => {
    expect(fountainFromBody('INT. KITCHEN\n\nShe waits.')).toBe('INT. KITCHEN\n\nShe waits.');
    expect(fountainFromBody('CUT TO:\n\nINT. ROOF')).toBe('CUT TO:\n\nINT. ROOF');
  });

  it('writes list paragraphs as they are and an empty body as nothing', () => {
    expect(fountainFromBody('- one\n- two')).toBe('- one\n- two');
    expect(fountainFromBody(null)).toBe('');
    expect(fountainFromBody('  \n ')).toBe('');
  });
});

describe('looksLikeCue', () => {
  it('knows a name from a shout', () => {
    for (const cue of [
      'MOM',
      'DR. SMITH',
      'MOM (O.S.)',
      'HANS (on the radio)',
      'STEEL ^',
      'JOSÉ',
    ]) {
      expect(looksLikeCue(cue), cue).toBe(true);
    }
    for (const notCue of [
      'Mom',
      'BANG!',
      'FADE OUT.',
      'CUT TO:',
      'INT. KITCHEN',
      '',
      '123',
      'WHO?',
    ]) {
      expect(looksLikeCue(notCue), notCue).toBe(false);
    }
  });
});
