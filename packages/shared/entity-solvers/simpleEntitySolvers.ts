import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntityReference, EntitySolverContext } from './contracts';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const SIMPLE_NAME_FIELDS: Partial<Record<OperationLogEntityType, string>> = {
  [OperationLogEntityType.Board]: 'name',
  [OperationLogEntityType.Story]: 'title',
  [OperationLogEntityType.StoryArc]: 'title',
  [OperationLogEntityType.Route]: 'name',
  [OperationLogEntityType.Character]: 'name',
  [OperationLogEntityType.Note]: 'title',
  [OperationLogEntityType.Location]: 'name',
  [OperationLogEntityType.LocationMap]: 'name',
  [OperationLogEntityType.Scene]: 'name',
  [OperationLogEntityType.Item]: 'name',
  [OperationLogEntityType.Choice]: 'text',
  [OperationLogEntityType.Tag]: 'name',
  [OperationLogEntityType.Plot]: 'name',
  [OperationLogEntityType.Stat]: 'name',
};

/** Resolves entities that identify themselves from one column, with their localized noun. */
export async function resolveSimpleEntityReference(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<EntityReference | undefined> {
  if (entityType === OperationLogEntityType.Gallery) {
    const row = await context.read(entityType, entityId);
    return {
      name: stringValue(row, 'title') ?? stringValue(row, 'fileName'),
      type: context.translate('gallery'),
    };
  }

  if (entityType === OperationLogEntityType.WorldRule) {
    const row = await context.read(entityType, entityId);
    const section = stringValue(row, 'section');
    return {
      name: stringValue(row, 'title'),
      type: section
        ? context.translate(`world_piece_section_${section}`)
        : await context.noun(OperationLogEntityType.WorldRule),
    };
  }

  if (entityType === OperationLogEntityType.Chapter) {
    const row = await context.read(entityType, entityId);
    return {
      name: stringValue(row, 'name'),
      type: await context.noun(
        stringValue(row, 'type') === 'event' ? 'Event' : OperationLogEntityType.Chapter,
      ),
    };
  }

  if (entityType === OperationLogEntityType.Mode) {
    const row = await context.read(entityType, entityId);
    if (!row) return { name: undefined, type: context.translate('mode') };
    const ownerId = stringValue(row, 'characterId');
    const owner = ownerId
      ? await context.read(OperationLogEntityType.Character, ownerId)
      : undefined;
    return {
      name: context.translate('mode_of_character', {
        modename: stringValue(row, 'name') ?? '',
        charactername: stringValue(owner, 'name') ?? context.translate('unknown_character'),
      }),
      type: context.translate('mode'),
    };
  }

  const field = SIMPLE_NAME_FIELDS[entityType];
  if (!field) return undefined;
  const row = await context.read(entityType, entityId);
  return {
    name:
      entityType === OperationLogEntityType.Plot
        ? (stringValue(row, field) ?? entityId)
        : stringValue(row, field),
    type: await context.noun(entityType),
  };
}
