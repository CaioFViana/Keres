import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies StoryArc operations received from the server to the local table. */
export class StoryArcClientSyncHandler extends TableClientSyncHandler<typeof schema.storyArcs> {
  readonly entityName = 'StoryArc';
  protected readonly table = schema.storyArcs;
  protected override readonly behavior = { stampStoryId: { create: true } };
}
