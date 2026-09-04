import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

/** Presentation metadata for a story-local calendar. */
export const storyCalendarEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.StoryCalendar,
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.StoryCalendar, entityId);
    const name = typeof row?.name === 'string' && row.name.trim() ? row.name : undefined;
    return { name, type: context.translate('calendar') };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await storyCalendarEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
