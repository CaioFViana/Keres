import type { BoardContentType } from '../schemas/BoardSchemas';

/**
 * A named spatial sketch over the story's dictionary. Pins and arrows live in `content`, not as
 * their own sync entities — see `BoardSchemas.ts`.
 */
export interface Board {
  id: string;
  storyId: string;
  name: string;
  description: string | null;
  content: BoardContentType;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
