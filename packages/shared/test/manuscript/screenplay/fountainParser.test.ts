import { describe, expect, it } from 'vitest';
import {
  emphasisRuns,
  parseFountain,
  stripFountainHiddenText,
} from '../../../manuscript/screenplay/fountainParser';

describe('parseFountain', () => {
  it('reads a title page up to the first blank line, with indented continuations', () => {
    const doc = parseFountain(
      'Title: The Heist\nCredit: Written by\nAuthor: Ana\nContact:\n    a@b.c\n    Street 1\n\nINT. KITCHEN\n\nShe waits.',
    );

    expect(doc.titlePage).toEqual([
      { key: 'Title', value: 'The Heist' },
      { key: 'Credit', value: 'Written by' },
      { key: 'Author', value: 'Ana' },
      { key: 'Contact', value: 'a@b.c\nStreet 1' },
    ]);
    expect(doc.elements[0]).toMatchObject({ type: 'scene-heading', text: 'INT. KITCHEN' });
  });

  it('has no title page when the text does not open with one', () => {
    expect(parseFountain('INT. KITCHEN\n\nShe waits.').titlePage).toEqual([]);
    expect(parseFountain('').elements).toEqual([]);
  });

  it('reads headings, forced headings and scene numbers', () => {
    const { elements } = parseFountain(
      'INT. KITCHEN - DAY #12A#\n\n.THE VOID\n\nEXT. ROOF\nWind.\n\nInterior. Not a heading',
    );

    expect(elements[0]).toEqual({
      type: 'scene-heading',
      text: 'INT. KITCHEN - DAY',
      number: '12A',
    });
    expect(elements[1]).toEqual({ type: 'scene-heading', text: 'THE VOID', number: null });
    // A heading with text stuck right under it is still a heading, and the text is action.
    expect(elements[2]).toEqual({ type: 'scene-heading', text: 'EXT. ROOF', number: null });
    expect(elements[3]).toEqual({ type: 'action', lines: ['Wind.'] });
    expect(elements[4]).toEqual({ type: 'action', lines: ['Interior. Not a heading'] });
  });

  it('reads a dialogue: cue, extension, parenthetical, lines and the second voice of a dual', () => {
    const { elements } = parseFountain(
      'MOM (O.S.)\n(whispering)\nBe careful.\nPlease.\n\nHANS (on the radio)\nCopy.\n\nSTEEL ^\nMe too.',
    );

    expect(elements).toEqual([
      { type: 'character', name: 'MOM', extension: 'O.S.', dual: false },
      { type: 'parenthetical', text: '(whispering)' },
      { type: 'dialogue', lines: ['Be careful.', 'Please.'] },
      { type: 'character', name: 'HANS', extension: 'on the radio', dual: false },
      { type: 'dialogue', lines: ['Copy.'] },
      { type: 'character', name: 'STEEL', extension: null, dual: true },
      { type: 'dialogue', lines: ['Me too.'] },
    ]);
  });

  it('keeps a paragraph break inside a dialogue when the line is two spaces', () => {
    const { elements } = parseFountain('MOM\nFirst.\n  \nSecond.');

    expect(elements[1]).toEqual({ type: 'dialogue', lines: ['First.', '', 'Second.'] });
  });

  it('needs dialogue under a cue: a capitalised line alone is action, unless forced', () => {
    expect(parseFountain('BOOM.').elements).toEqual([{ type: 'action', lines: ['BOOM.'] }]);
    expect(parseFountain('@McCLANE\nYippee.').elements[0]).toMatchObject({
      type: 'character',
      name: 'McCLANE',
    });
    expect(parseFountain('Mom\nBe careful.').elements).toEqual([
      { type: 'action', lines: ['Mom', 'Be careful.'] },
    ]);
  });

  it('reads transitions, centered text, page breaks, lyrics and forced action', () => {
    const { elements } = parseFountain(
      'CUT TO:\n\n> Burn to white.\n\n>THE END<\n\n===\n\n~Willy wonka!\n\n!NOT A CUE\nOK.',
    );

    expect(elements.map((element) => element.type)).toEqual([
      'transition',
      'transition',
      'centered',
      'page-break',
      'lyrics',
      'action',
    ]);
    expect(elements[1]).toMatchObject({ text: 'Burn to white.' });
    expect(elements[2]).toMatchObject({ text: 'THE END' });
    expect(elements[5]).toEqual({ type: 'action', lines: ['NOT A CUE', 'OK.'] });
  });

  it('reads sections and synopses, which are for the writer', () => {
    const { elements } = parseFountain('# Act One\n= They plan.\n\n## Sequence\n\nAction.');

    expect(elements).toEqual([
      { type: 'section', depth: 1, text: 'Act One' },
      { type: 'synopsis', text: 'They plan.' },
      { type: 'section', depth: 2, text: 'Sequence' },
      { type: 'action', lines: ['Action.'] },
    ]);
  });

  it('drops notes and boneyard, across lines too', () => {
    expect(stripFountainHiddenText('A [[note]] B /* gone\nfor good */ C')).toBe('A  B  C');
    const { elements } = parseFountain('She waits. [[check this]]\n\n/* MOM\nNo. */\n\nHe goes.');
    expect(elements).toEqual([
      { type: 'action', lines: ['She waits. '.trimEnd()] },
      { type: 'action', lines: ['He goes.'] },
    ]);
  });

  it('turns tabs into four spaces and keeps leading spaces of action', () => {
    expect(parseFountain('\tIndented.').elements).toEqual([
      { type: 'action', lines: ['    Indented.'] },
    ]);
  });

  it('never throws on rubbish', () => {
    for (const rubbish of [
      '\u0000',
      '###',
      '=',
      '>',
      '~',
      '@',
      '^',
      '(((',
      '[[unclosed',
      '/* unclosed',
    ]) {
      expect(() => parseFountain(rubbish)).not.toThrow();
    }
  });
});

describe('emphasisRuns', () => {
  it('splits bold, italic, both and underline', () => {
    expect(emphasisRuns('a *b* **c** ***d*** _e_ f')).toEqual([
      { text: 'a ', bold: false, italic: false, underline: false },
      { text: 'b', bold: false, italic: true, underline: false },
      { text: ' ', bold: false, italic: false, underline: false },
      { text: 'c', bold: true, italic: false, underline: false },
      { text: ' ', bold: false, italic: false, underline: false },
      { text: 'd', bold: true, italic: true, underline: false },
      { text: ' ', bold: false, italic: false, underline: false },
      { text: 'e', bold: false, italic: false, underline: true },
      { text: ' f', bold: false, italic: false, underline: false },
    ]);
  });

  it('treats an unclosed marker as text and honours escapes', () => {
    expect(
      emphasisRuns('2 * 3 and snake_case_name')
        .map((run) => run.text)
        .join(''),
    ).toBe('2 * 3 and snake_case_name');
    expect(emphasisRuns('\\*not italic\\*')).toEqual([
      { text: '*not italic*', bold: false, italic: false, underline: false },
    ]);
  });

  it('returns nothing for an empty line', () => {
    expect(emphasisRuns('')).toEqual([]);
  });
});
