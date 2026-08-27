import type { ChapterRelationType } from '../metadata/ChapterRelationType';

/** Both ends are `chapters` rows: an event is a chapter. See `ChapterRelationSchemas.ts`. */
export interface ChapterRelation {
  id: string;
  storyId: string;
  chapter1Id: string;
  chapter2Id: string;
  relationType: ChapterRelationType;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
