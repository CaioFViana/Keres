import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/**
 * Anchors arriving from a server.
 *
 * Nothing to reconcile beyond the row itself: an anchor is a statement about one container, and two
 * of them for the same container are two stretches rather than a disagreement. That is why this has
 * none of the duplicate-pair handling the relation handlers carry - the model stopped having pairs.
 */
export class ChapterAnchorClientSyncHandler extends TableClientSyncHandler<
  typeof schema.chapterAnchors
> {
  readonly entityName = 'ChapterAnchor';
  protected readonly table = schema.chapterAnchors;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
    updateOnlyHeldRows: true,
  };
}
