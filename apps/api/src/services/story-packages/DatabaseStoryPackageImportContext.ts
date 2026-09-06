import type { FullStoryExportType } from '@keres/shared';
import type { CompatibleDb } from '../../db';

/**
 * Mutable state shared by every ordered import phase within one database transaction. It keeps
 * transaction mechanics and generated-ID state out of entity conversion functions.
 */
export interface DatabaseStoryPackageImportContext {
  tx: CompatibleDb;
  fullStory: FullStoryExportType;
  userId: string;
  targetStoryId: string;
  now: Date;
  idMap: Map<string, string>;
  nextId: (originalId: string) => string;
}
