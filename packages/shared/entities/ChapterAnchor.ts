import type { ScenePosition } from '../metadata/ScenePosition';

/** One stretch of story time a container occupies. See `ChapterAnchorSchemas.ts`. */
export interface ChapterAnchor {
  id: string;
  storyId: string;
  chapterId: string;
  order: number;
  startSceneId: string;
  startPosition: ScenePosition;
  startOffset: number | null;
  startOffsetUnit: string | null;
  endSceneId: string;
  endPosition: ScenePosition;
  endOffset: number | null;
  endOffsetUnit: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
