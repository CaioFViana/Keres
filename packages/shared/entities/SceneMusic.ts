/**
 * Whether the people in the story hear the music.
 *
 * `in-world` exists inside the story - someone sings it, plays it, hears it: a tavern song, a hymn,
 * a lullaby. Its lyrics may appear in the text. `score` exists for whoever tells the story, not for
 * those who live it: the soundtrack of a comic scene, the theme of an animation, the music playing
 * at the table during a fight. It never appears in the text.
 *
 * It sits on the link, not on the song, because the same song can be sung by the bard in one scene
 * and play as score at the funeral in another.
 */
export const SCENE_MUSIC_ROLES = ['in-world', 'score'] as const;

export type SceneMusicRole = (typeof SCENE_MUSIC_ROLES)[number];

/**
 * A piece of music a scene has: a `Song` made here, or a medium of the Gallery (a recording, a link).
 * The scene's music is ordered by `rank`, like every arranged row, and a scene may have any number.
 *
 * Exactly one of `songId` and `galleryId` is set when the link is made. Either may later point at
 * something that is gone - another device deleted the Song - and the link survives with its note;
 * the writer can point it at something else. Story Analysis reports it.
 */
export interface SceneMusic {
  id: string;
  storyId: string;
  sceneId: string;
  /** Place among the scene's music (`rules/rank.ts`); sorted by `(rank, id)` everywhere. */
  rank: string;
  /** A Song of this story. */
  songId: string | null;
  /** A Gallery medium of this story: an audio file or a link, never published. */
  galleryId: string | null;
  role: SceneMusicRole;
  /** When it comes in and goes out ("as she opens the door"); free text. */
  cue: string | null;
  /**
   * Which sections of the song this scene sings, by the labels in its lyrics ("Chorus"); `null` is the
   * whole song. Only meaningful for a `songId`.
   */
  sections: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
