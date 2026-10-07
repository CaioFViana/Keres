import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  ManuscriptOptionsSchema,
  type ManuscriptOptionsInput,
} from '../../../manuscript/compile/manuscriptContracts';
import type {
  ManuscriptChapter,
  ManuscriptScene,
  ManuscriptSceneMusic,
  ManuscriptSong,
} from '../../../manuscript/compile/manuscriptSections';
import { presentedManuscriptOf } from '../../../manuscript/compile/presentedManuscript';
import { compileScreenplayManuscript } from '../../../manuscript/screenplay/compileScreenplay';

const LYRICS = [
  '{sov: Verse 1}',
  '[G]Light the [Em]lantern',
  'By the old gate',
  '',
  'Hold it high',
  '{eov}',
  '{soc: Chorus}',
  'Home, home, home',
  '{eoc}',
  '{sov: Verse 2}',
  'Dark falls fast',
  '{eov}',
].join('\n');

const TRANSLATION = [
  '{sov: Verse 1}',
  'Acende o lampi\u00e3o',
  'No velho port\u00e3o',
  '{eov}',
  '{soc: Chorus}',
  'Casa, casa, casa',
  '{eoc}',
].join('\n');

const song = (overrides: Partial<ManuscriptSong> = {}): ManuscriptSong => ({
  id: 'song-1',
  title: 'The Lantern Song',
  lyrics: LYRICS,
  lyricsTranslation: null,
  sections: null,
  ...overrides,
});

const sung = (
  songValue: ManuscriptSong,
  role: 'in-world' | 'score' = 'in-world',
): ManuscriptSceneMusic => ({
  id: `m-${songValue.id}-${role}`,
  role,
  title: songValue.title,
  cue: null,
  song: songValue,
});

const chapters: ManuscriptChapter[] = [{ id: 'ch-1', name: 'One', index: 1, type: 'chapter' }];

const scene = (id: string, index: number, music: ManuscriptSceneMusic[]): ManuscriptScene => ({
  id,
  chapterId: 'ch-1',
  name: id,
  index,
  body: `Text of ${id}.`,
  isDeleted: false,
  music,
});

const compile = (scenes: ManuscriptScene[], options: Partial<ManuscriptOptionsInput> = {}) =>
  presentedManuscriptOf(
    { storyTitle: 'Book', storyType: 'linear', chapters, scenes, choices: [] },
    ManuscriptOptionsSchema.parse({ format: 'html', includeSongs: true, ...options }),
    { ...DEFAULT_MANUSCRIPT_LABELS, ...options.labels },
  ).blocks;

/** The blocks as short strings, for reading a manuscript at a glance. */
const outline = (blocks: ReturnType<typeof compile>) =>
  blocks.flatMap((block) => {
    if (block.kind === 'paragraph') {
      return [
        `${block.spans[0].italic ? 'i:' : block.spans[0].bold ? 'b:' : ''}${block.spans.map((part) => part.text).join('')}`,
      ];
    }
    if (block.kind === 'loose-heading') return [`## ${block.label}`];
    if (block.kind === 'chapter' || block.kind === 'title') return [];
    return [];
  });

describe('songs in the manuscript', () => {
  it('prints none unless asked', () => {
    const blocks = compile([scene('s1', 1, [sung(song())])], { includeSongs: false });

    expect(outline(blocks)).toEqual(['Text of s1.']);
  });

  it('prints only what is sung in the story, never what plays under it', () => {
    const blocks = compile([scene('s1', 1, [sung(song(), 'score')])], {
      songsPlacement: 'after-scene',
    });

    expect(outline(blocks)).toEqual(['Text of s1.']);
  });

  describe('after the scene', () => {
    const options = { songsPlacement: 'after-scene' } as const;

    it('sets the stanzas in italics, a stanza to a paragraph, with no title or labels', () => {
      const blocks = compile([scene('s1', 1, [sung(song())])], options);

      expect(outline(blocks)).toEqual([
        'Text of s1.',
        'i:Light the lantern\nBy the old gate',
        'i:Hold it high',
        'i:Home, home, home',
        'i:Dark falls fast',
      ]);
    });

    it('prints only the sections the scene sings, in the order of the song', () => {
      const blocks = compile(
        [scene('s1', 1, [sung(song({ sections: ['Verse 2', 'Chorus'] }))])],
        options,
      );

      expect(outline(blocks)).toEqual(['Text of s1.', 'i:Home, home, home', 'i:Dark falls fast']);
    });

    it('prints the whole song when none of the sections it names is left', () => {
      const blocks = compile([scene('s1', 1, [sung(song({ sections: ['Coro'] }))])], options);

      expect(outline(blocks)).toContain('i:Home, home, home');
      expect(outline(blocks)).toContain('i:Dark falls fast');
    });

    it('prints what is left when only some of the sections it names are gone', () => {
      const blocks = compile(
        [scene('s1', 1, [sung(song({ sections: ['Chorus', 'Coro'] }))])],
        options,
      );

      expect(outline(blocks)).toEqual(['Text of s1.', 'i:Home, home, home']);
    });

    it('prints a part once, and only names the song where it was sung before', () => {
      const lantern = song({ sections: ['Chorus'] });
      const blocks = compile(
        [scene('s1', 1, [sung(lantern)]), scene('s2', 2, [sung(lantern)])],
        options,
      );

      expect(outline(blocks)).toEqual([
        'Text of s1.',
        'i:Home, home, home',
        'Text of s2.',
        'i:\u266a The Lantern Song',
      ]);
    });

    it('prints a part again when asked to', () => {
      const lantern = song({ sections: ['Chorus'] });
      const blocks = compile([scene('s1', 1, [sung(lantern)]), scene('s2', 2, [sung(lantern)])], {
        ...options,
        songRepeat: 'every',
      });

      expect(outline(blocks).filter((line) => line === 'i:Home, home, home')).toHaveLength(2);
    });

    it('lets a later scene print the part an earlier one did not', () => {
      const blocks = compile(
        [
          scene('s1', 1, [sung(song({ sections: ['Chorus'] }))]),
          scene('s2', 2, [sung(song({ sections: ['Chorus', 'Verse 2'] }))]),
        ],
        options,
      );

      expect(outline(blocks)).toEqual([
        'Text of s1.',
        'i:Home, home, home',
        'Text of s2.',
        'i:Dark falls fast',
      ]);
    });

    it('prints a recall as its label and a comment as it is', () => {
      const withRecall = song({
        lyrics: '{soc: Chorus}\nHome\n{chorus: Chorus}\n{comment: slowly}\n{eoc}',
      });
      const blocks = compile([scene('s1', 1, [sung(withRecall)])], options);

      expect(outline(blocks)).toEqual(['Text of s1.', 'i:Home', 'i:(Chorus)', 'i:slowly']);
    });

    it('keeps the chords in brackets when asked, and the syllable marks never', () => {
      const marked = song({ lyrics: '[G]No\u00b7ite [Em]cai' });
      const plain = compile([scene('s1', 1, [sung(marked)])], options);
      const withChords = compile([scene('s1', 1, [sung(marked)])], {
        ...options,
        songChords: true,
      });

      expect(outline(plain)).toContain('i:Noite cai');
      expect(outline(withChords)).toContain('i:[G]Noite [Em]cai');
    });

    it('prints the translation under the sung words, or instead of them, by section', () => {
      const lantern = song({ lyricsTranslation: TRANSLATION, sections: ['Verse 1', 'Chorus'] });
      const both = outline(
        compile([scene('s1', 1, [sung(lantern)])], { ...options, songLanguage: 'both' }),
      );
      const only = outline(
        compile([scene('s1', 1, [sung(lantern)])], { ...options, songLanguage: 'translation' }),
      );

      expect(both).toEqual([
        'Text of s1.',
        'i:Light the lantern\nBy the old gate',
        'i:Hold it high',
        'Acende o lampi\u00e3o\nNo velho port\u00e3o',
        'i:Home, home, home',
        'Casa, casa, casa',
      ]);
      expect(only).toEqual([
        'Text of s1.',
        'Acende o lampi\u00e3o\nNo velho port\u00e3o',
        'Casa, casa, casa',
      ]);
    });

    it('prints the sung words where the translation has no such section', () => {
      const lantern = song({ lyricsTranslation: TRANSLATION, sections: ['Verse 2'] });
      const blocks = compile([scene('s1', 1, [sung(lantern)])], {
        ...options,
        songLanguage: 'translation',
      });

      expect(outline(blocks)).toEqual(['Text of s1.', 'i:Dark falls fast']);
    });
  });

  describe('in an appendix', () => {
    it('gathers each song once, whole, under its title and the labels of its sections', () => {
      const blocks = compile([
        scene('s1', 1, [sung(song({ sections: ['Chorus'] }))]),
        scene('s2', 2, [sung(song({ sections: ['Verse 2'] }))]),
      ]);

      expect(outline(blocks)).toEqual([
        'Text of s1.',
        'Text of s2.',
        '## Songs',
        'b:The Lantern Song',
        'b:Verse 1',
        'i:Light the lantern\nBy the old gate',
        'i:Hold it high',
        'b:Chorus',
        'i:Home, home, home',
        'b:Verse 2',
        'i:Dark falls fast',
      ]);
    });

    it('orders the songs by the scene that first sings them', () => {
      const second = song({ id: 'song-2', title: 'Second', lyrics: '{sov: A}\nb\n{eov}' });
      const blocks = compile([
        scene('s1', 1, [sung(second)]),
        scene('s2', 2, [sung(song())]),
        scene('s3', 3, [sung(second)]),
      ]);

      const titles = outline(blocks).filter(
        (line) => line.startsWith('b:') && !line.includes(':A'),
      );
      expect(titles.slice(0, 2)).toEqual(['b:Second', 'b:The Lantern Song']);
    });

    it('writes nothing, not even a heading, when no scene sings a song', () => {
      const blocks = compile([scene('s1', 1, [sung(song(), 'score')])]);

      expect(outline(blocks)).toEqual(['Text of s1.']);
    });

    it('takes the heading from the labels it is given', () => {
      const blocks = compile([scene('s1', 1, [sung(song())])], {
        labels: { songsHeading: 'Canções' },
      });

      expect(outline(blocks)).toContain('## Canções');
    });
  });
});

describe('songs in a screenplay', () => {
  const input = (music: ManuscriptSceneMusic[]) => ({
    storyTitle: 'Script',
    storyType: 'linear' as const,
    chapters,
    scenes: [scene('s1', 1, music)],
    choices: [],
  });
  const script = (music: ManuscriptSceneMusic[], extra: Partial<ManuscriptOptionsInput> = {}) =>
    new TextDecoder().decode(
      compileScreenplayManuscript(
        input(music),
        ManuscriptOptionsSchema.parse({ format: 'fountain', includeSongs: true, ...extra }),
      ).bytes,
    );

  it('writes the lyrics as Fountain lyrics, which a script prints, one line to a lyric line', () => {
    const text = script([sung(song({ sections: ['Verse 1'] }))]);

    expect(text).toContain('~Light the lantern\n~By the old gate');
    expect(text).toContain('~Hold it high');
  });

  it('leaves them out unless asked, and never writes what plays under the scene', () => {
    expect(script([sung(song())], { includeSongs: false })).not.toContain('~');
    expect(script([sung(song(), 'score')])).not.toContain('~');
  });

  it('writes a part once, as in a book', () => {
    const lantern = song({ sections: ['Chorus'] });
    const text = compileScreenplayManuscript(
      {
        storyTitle: 'Script',
        storyType: 'linear',
        chapters,
        scenes: [scene('s1', 1, [sung(lantern)]), scene('s2', 2, [sung(lantern)])],
        choices: [],
      },
      ManuscriptOptionsSchema.parse({ format: 'fountain', includeSongs: true }),
    );

    expect(new TextDecoder().decode(text.bytes).match(/~Home, home, home/g)).toHaveLength(1);
  });
});
