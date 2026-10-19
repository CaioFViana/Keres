import type { ExampleStoryLanguage } from './exampleStoryBuilderSupport';

type Context = {
  slug: string;
  language: ExampleStoryLanguage;
  storyId: string;
  id: (key: string) => string;
  base: (id: string, storyId: string) => Record<string, any>;
  scenes: { id: string }[];
};

/**
 * The songs of the bundled stories, and the scenes that sing them. Both are public domain (Carroll,
 * 1865); the Portuguese words are a free rendering written for this catalogue.
 *
 * Alice is the story that shows them: she recites one song in the scene where she shrinks and grows,
 * and the Hatter mentions another at the trial. The first is sung in part (a section of two), the
 * second whole, so a manuscript has both a partial and a whole song to print. No recording is bundled
 * (see "Media rule" in `docs/example_story_feature_matrix.md`).
 */
const SONGS = {
  crocodile: {
    en: {
      title: 'How Doth the Little Crocodile',
      notes:
        'Carroll’s parody of Isaac Watts’s “How doth the little busy bee”. Alice recites it and gets the words wrong. Public domain (1865).',
      lyrics: [
        '{sov: Verse 1}',
        'How doth the little crocodile',
        'Improve his shining tail,',
        'And pour the waters of the Nile',
        'On every golden scale!',
        '{eov}',
        '{sov: Verse 2}',
        'How cheerfully he seems to grin,',
        'How neatly spreads his claws,',
        'And welcomes little fishes in,',
        'With gently smiling jaws!',
        '{eov}',
      ].join('\n'),
      cue: 'Alice tries to say it by heart, and the words come out wrong.',
    },
    pt: {
      title: 'Como Faz o Pequeno Crocodilo',
      notes:
        'Paródia de Carroll de “How doth the little busy bee”, de Isaac Watts. Alice a recita e troca as palavras. Domínio público (1865); a letra é uma versão livre feita para este catálogo.',
      lyrics: [
        '{sov: Verso 1}',
        'Como faz o pequeno crocodilo',
        'Para lustrar a cauda a reluzir,',
        'E derramar as águas do Nilo',
        'Em cada escama de ouro a luzir!',
        '{eov}',
        '{sov: Verso 2}',
        'Que alegre parece sorrir,',
        'Com que esmero abre as garras,',
        'E acolhe os peixinhos a entrar',
        'Com suaves mandíbulas risonhas!',
        '{eov}',
      ].join('\n'),
      cue: 'Alice tenta dizer de cor, e as palavras saem erradas.',
    },
    sections: { en: ['Verse 1'], pt: ['Verso 1'] },
  },
  bat: {
    en: {
      title: 'Twinkle, Twinkle, Little Bat',
      notes:
        'The Hatter’s song, sung to the tune of “Twinkle, Twinkle, Little Star”. The Queen says he is murdering the time. Public domain (1865).',
      lyrics: [
        '{sov: Verse 1}',
        '[C]Twinkle, twinkle, [F]little [C]bat!',
        'How I [F]wonder [C]what you’re [G]at!',
        '[C]Up above the [F]world you [C]fly,',
        'Like a [G]tea-tray in the [C]sky.',
        '{eov}',
      ].join('\n'),
      cue: 'The Hatter, on the stand, tells how he sang it at the Queen’s concert.',
    },
    pt: {
      title: 'Brilha, Brilha, Morceguão',
      notes:
        'A canção do Chapeleiro, cantada na melodia de “Twinkle, Twinkle, Little Star”. A Rainha diz que ele está assassinando o tempo. Domínio público (1865); a letra é uma versão livre feita para este catálogo.',
      lyrics: [
        '{sov: Verso 1}',
        '[C]Brilha, brilha, [F]morce[C]gão!',
        'Que [F]fará, não [C]sei, en[G]tão!',
        '[C]Lá no alto a es[F]voa[C]çar,',
        'Ban[G]deja de chá no [C]ar.',
        '{eov}',
      ].join('\n'),
      cue: 'O Chapeleiro, no banco, conta como a cantou no concerto da Rainha.',
    },
  },
} as const;

export function buildExampleStorySongs(context: Context) {
  const { slug, language, storyId, id, base, scenes } = context;
  if (slug !== 'alice-in-wonderland') return { songs: [], sceneMusic: [] };
  // The scenes are found by their place in the story, which the narrative fixes: the one where she
  // shrinks and grows, and the trial.
  if (scenes.length < 10) {
    throw new Error(
      `${slug}: expects the scene of the potion and the trial, but has ${scenes.length} scenes.`,
    );
  }
  const lang = language;
  const crocodile = SONGS.crocodile[lang];
  const bat = SONGS.bat[lang];

  const crocodileId = id('song-crocodile');
  const batId = id('song-bat');
  const songs = [
    {
      ...base(crocodileId, storyId),
      title: crocodile.title,
      notes: crocodile.notes,
      lyrics: crocodile.lyrics,
      lyricsTranslation: null,
      melody: null,
      key: null,
      tempo: null,
      meter: null,
    },
    {
      ...base(batId, storyId),
      title: bat.title,
      notes: bat.notes,
      lyrics: bat.lyrics,
      lyricsTranslation: null,
      melody: null,
      key: 'C',
      tempo: 100,
      meter: '4/4',
    },
  ];
  const sceneMusic = [
    {
      ...base(id('scene-music-crocodile'), storyId),
      sceneId: scenes[2].id,
      rank: 'a0',
      songId: crocodileId,
      galleryId: null,
      role: 'in-world',
      cue: crocodile.cue,
      sections: [...SONGS.crocodile.sections[lang]],
    },
    {
      ...base(id('scene-music-bat'), storyId),
      sceneId: scenes[9].id,
      rank: 'a0',
      songId: batId,
      galleryId: null,
      role: 'in-world',
      cue: bat.cue,
      sections: null,
    },
  ];
  return { songs, sceneMusic };
}
