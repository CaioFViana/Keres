import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  ManuscriptOptionsSchema,
  type ManuscriptOptionsInput,
} from '../../../manuscript/compile/manuscriptContracts';
import { musicCueLine } from '../../../manuscript/compile/export/manuscriptCompiler';
import type {
  ManuscriptChapter,
  ManuscriptSceneMusic,
  ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';
import { presentedManuscriptOf } from '../../../manuscript/compile/presentedManuscript';
import { compileFountain, type FountainScene } from '../../../manuscript/screenplay/fountain';
import { compileScreenplayManuscript } from '../../../manuscript/screenplay/compileScreenplay';

const music = (
  id: string,
  title: string | null,
  cue: string | null,
  role: 'in-world' | 'score' = 'score',
): ManuscriptSceneMusic => ({ id, role, title, cue });

const chapters: ManuscriptChapter[] = [{ id: 'ch-1', name: 'One', index: 1, type: 'chapter' }];

const scene = (id: string, index: number, list: ManuscriptSceneMusic[], body = 'Text.') =>
  ({
    id,
    chapterId: 'ch-1',
    name: id,
    index,
    body,
    isDeleted: false,
    music: list,
  }) satisfies ManuscriptScene;

describe('musicCueLine', () => {
  it('says the label, the title and the cue', () => {
    expect(musicCueLine('Music', music('m', 'Tavern song', 'as she sings'))).toBe(
      'Music: Tavern song — as she sings',
    );
  });

  it('keeps what there is when the title or the cue is missing', () => {
    expect(musicCueLine('Music', music('m', 'Tavern song', null))).toBe('Music: Tavern song');
    expect(musicCueLine('Music', music('m', null, 'cuts at the scream'))).toBe(
      'Music: cuts at the scream',
    );
  });

  it('says nothing for music with neither, and flattens a cue of several lines', () => {
    expect(musicCueLine('Music', music('m', null, null))).toBe('');
    expect(musicCueLine('Music', music('m', '  ', '   '))).toBe('');
    expect(musicCueLine('Music', music('m', 'Song', 'in\n  at   the door'))).toBe(
      'Music: Song — in at the door',
    );
  });
});

describe('the music of a scene in a book', () => {
  const scenes = [
    scene('s1', 1, [
      music('m1', 'Tavern song', 'as she sings', 'in-world'),
      music('m2', null, null),
    ]),
    scene('s2', 2, []),
  ];
  const compile = (options: Partial<ManuscriptOptionsInput> = {}) =>
    presentedManuscriptOf(
      { storyTitle: 'Book', storyType: 'linear', chapters, scenes, choices: [] },
      ManuscriptOptionsSchema.parse({ format: 'html', ...options }),
      { ...DEFAULT_MANUSCRIPT_LABELS, ...options.labels },
    ).blocks;

  const lines = (options: Partial<ManuscriptOptionsInput> = {}) =>
    compile(options)
      .filter((block) => block.kind === 'paragraph')
      .map((block) => block.spans.map((span) => span.text).join(''));

  it('leaves the music out unless asked', () => {
    expect(lines()).toEqual(['Text.', 'Text.']);
  });

  it('writes each piece under its scene as a line of italic text', () => {
    const blocks = compile({ includeMusicCues: true });
    const music = blocks.filter(
      (block) => block.kind === 'paragraph' && block.spans[0].text.startsWith('Music:'),
    );

    expect(music).toHaveLength(1);
    expect(music[0]).toMatchObject({
      spans: [{ text: 'Music: Tavern song — as she sings', italic: true }],
    });
  });

  it('puts the music after the text of its scene and before the next', () => {
    expect(lines({ includeMusicCues: true })).toEqual([
      'Text.',
      'Music: Tavern song — as she sings',
      'Text.',
    ]);
  });

  it('uses the label it was given', () => {
    const labelled = lines({ includeMusicCues: true, labels: { musicLabel: 'Trilha' } });

    expect(labelled[1]).toBe('Trilha: Tavern song — as she sings');
  });
});

describe('the music of a scene in a screenplay', () => {
  const fountainScene = (
    id: string,
    list: ManuscriptSceneMusic[],
    body = 'Action.',
  ): FountainScene => ({
    ...scene(id, 1, list, body),
  });
  const write = (scenes: FountainScene[], includeMusicNotes: boolean) =>
    compileFountain({ title: 'Script', chapters, scenes }, { includeMusicNotes, titlePage: false })
      .text;

  it('writes one note per piece, which Fountain never prints', () => {
    const text = write(
      [
        fountainScene('s1', [
          music('m1', 'Theme', 'comes in at the door'),
          music('m2', 'Bell', null),
        ]),
      ],
      true,
    );

    expect(text).toContain('[[Music: Theme — comes in at the door]]');
    expect(text).toContain('[[Music: Bell]]');
    expect(text.indexOf('[[Music: Theme')).toBeLessThan(text.indexOf('Action.'));
  });

  it('leaves the notes out unless asked', () => {
    expect(write([fountainScene('s1', [music('m1', 'Theme', 'x')])], false)).not.toContain('[[');
  });

  it('cannot be ended early by what the writer typed', () => {
    const text = write([fountainScene('s1', [music('m1', 'Theme', 'a ]] b')])], true);

    expect(text).toContain('[[Music: Theme — a ] ] b]]');
  });

  it('comes through the screenplay compiler when its option is on', () => {
    const input = {
      storyTitle: 'Script',
      storyType: 'linear' as const,
      chapters,
      scenes: [scene('s1', 1, [music('m1', 'Theme', 'in')])],
      choices: [],
    };
    const options = ManuscriptOptionsSchema.parse({
      format: 'fountain',
      screenplay: { includeMusicNotes: true },
      labels: { musicLabel: 'Musica' },
    });

    const compiled = compileScreenplayManuscript(input, options);

    expect(new TextDecoder().decode(compiled.bytes)).toContain('[[Musica: Theme — in]]');
  });
});
