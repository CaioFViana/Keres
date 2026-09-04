import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const titleOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.title;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a story Arc, including the v10 chapter association surface. */
export const storyArcEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.StoryArc,
  help: {
    source: 'arcs',
    fields: ['title', 'description', 'themeOverride'],
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.StoryArc, entityId);
    return {
      name: titleOf(row),
      type: await context.noun(OperationLogEntityType.StoryArc),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await storyArcEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
