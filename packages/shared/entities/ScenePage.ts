/** How an image sits in the frame of its page: shown whole, or cropped (centred) to fill it. */
export const SCENE_PAGE_FITS = ['contain', 'cover'] as const;

export type ScenePageFit = (typeof SCENE_PAGE_FITS)[number];

/**
 * One page of a scene in a comic, or one frame of a storyboard: an image (a Sketch drawn here, or a
 * medium already in the Gallery) and the text that goes with it. The scene's pages are ordered by
 * `rank`, like every arranged row, and a scene may have any number of them.
 *
 * The text is what would be printed under (or beside) the page, so a drawing does not need its
 * balloons filled in: it can carry numbers, and the text says what each one holds.
 *
 * Exactly one of `sketchId` and `galleryId` is set when a page is made. Either may later point at
 * something that is gone - another device deleted the Sketch - and the page survives with its text
 * and shows "media removed"; the writer can put another image in its place.
 */
export interface ScenePage {
  id: string;
  storyId: string;
  sceneId: string;
  /** Place among the scene's pages (`rules/rank.ts`); sorted by `(rank, id)` everywhere. */
  rank: string;
  /** A Sketch of this story, whose gallery snapshot is what a manuscript shows. */
  sketchId: string | null;
  /** A Gallery medium (an image) of this story. */
  galleryId: string | null;
  fit: ScenePageFit;
  /** What goes with the page; free text. */
  text: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
