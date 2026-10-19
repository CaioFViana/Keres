/**
 * What a scene's music is called in a kind of work. Only a word: the music is the same everywhere.
 * A comic or a storyboard has a soundtrack, a screenplay its music cues, a campaign the music at
 * the table, and anything else (a novel, say) just music.
 */
export type SceneMusicWord = 'music' | 'cues' | 'table' | 'soundtrack';

export function sceneMusicWord(medium: string | null | undefined): SceneMusicWord {
  switch (medium) {
    case 'screenplay':
      return 'cues';
    case 'campaign':
      return 'table';
    case 'comic':
    case 'storyboard':
      return 'soundtrack';
    default:
      return 'music';
  }
}

/** The translation key of the word, e.g. `scene_music_word_cues`. */
export const sceneMusicWordKey = (medium: string | null | undefined) =>
  `scene_music_word_${sceneMusicWord(medium)}`;
