import type { EffectiveStoryRole, FullStoryExportType } from '@keres/shared';
import type { AppDrizzleTransaction } from '../../../db';

/** Shared transaction state for the ordered SQLite story-package import phases. */
export interface SQLiteStoryPackageImportContext {
  tx: AppDrizzleTransaction;
  fullStory: FullStoryExportType;
  storyId: string;
  userId: string;
  queriedServerId: string | null;
  role: EffectiveStoryRole | null;
  localMediaPaths?: Map<string, string>;
}
