import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/**
 * The entities of the stats system (and the modes) only carry columns of their own, with no derived key
 * nor cascade like StorySchemaField, so they take the base class as it is. A create that was already
 * applied is ignored, and the story is stamped into the row.
 */
const STATS_BEHAVIOR = { stampStoryId: { create: true }, ignoreDuplicateCreate: true } as const;

export class StatClientSyncHandler extends TableClientSyncHandler<typeof schema.stats> {
  readonly entityName = 'Stat';
  protected readonly table = schema.stats;
  protected override readonly behavior = STATS_BEHAVIOR;
}

export class StatStrengthClientSyncHandler extends TableClientSyncHandler<
  typeof schema.statStrengths
> {
  readonly entityName = 'StatStrength';
  protected readonly table = schema.statStrengths;
  protected override readonly behavior = STATS_BEHAVIOR;
}

export class StatRelationClientSyncHandler extends TableClientSyncHandler<
  typeof schema.statRelations
> {
  readonly entityName = 'StatRelation';
  protected readonly table = schema.statRelations;
  protected override readonly behavior = STATS_BEHAVIOR;
}

export class ModeClientSyncHandler extends TableClientSyncHandler<typeof schema.modes> {
  readonly entityName = 'Mode';
  protected readonly table = schema.modes;
  protected override readonly behavior = STATS_BEHAVIOR;
}
