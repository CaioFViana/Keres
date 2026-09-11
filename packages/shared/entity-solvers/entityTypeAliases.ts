import { OperationLogEntityType } from '../metadata/OperationLogEntityType';

/**
 * Relation rows historically persist lowercase entity names, while sync and operation logs use
 * enum values. This is the one canonical conversion instead of a map in every caller.
 */
export const ENTITY_TYPE_ALIASES: Readonly<Record<string, OperationLogEntityType>> = Object.values(
  OperationLogEntityType,
).reduce(
  (aliases, entityType) => ({ ...aliases, [entityType.toLowerCase()]: entityType }),
  {} as Record<string, OperationLogEntityType>,
);

export function resolveEntityTypeAlias(value: string): OperationLogEntityType | undefined {
  return ENTITY_TYPE_ALIASES[value.toLowerCase()];
}

/**
 * String inputs accepted by the long-standing client identifier facade. Keep this deliberately
 * narrower than the full operation-log enum: callers have historically received an error for
 * types that are not entity-reference values.
 */
const LEGACY_IDENTIFIER_ENTITY_TYPES = new Set<OperationLogEntityType>([
  OperationLogEntityType.Board,
  OperationLogEntityType.LocationMap,
  OperationLogEntityType.Chapter,
  OperationLogEntityType.Character,
  OperationLogEntityType.Choice,
  OperationLogEntityType.Item,
  OperationLogEntityType.ItemJourney,
  OperationLogEntityType.Location,
  OperationLogEntityType.Note,
  OperationLogEntityType.OperationLog,
  OperationLogEntityType.Scene,
  OperationLogEntityType.Story,
  OperationLogEntityType.StoryArc,
  OperationLogEntityType.Tag,
  OperationLogEntityType.User,
  OperationLogEntityType.WorldRule,
  OperationLogEntityType.CharacterRelation,
  OperationLogEntityType.LocationRelation,
  OperationLogEntityType.NoteRelation,
  OperationLogEntityType.TagRelation,
  OperationLogEntityType.CharacterScene,
  OperationLogEntityType.Plot,
  OperationLogEntityType.PlotScene,
  OperationLogEntityType.Route,
  OperationLogEntityType.RouteStep,
  OperationLogEntityType.Gallery,
  OperationLogEntityType.GalleryRelation,
  OperationLogEntityType.Favorite,
  OperationLogEntityType.SeeAlsoRelation,
  OperationLogEntityType.Comment,
  OperationLogEntityType.ChoiceCheckGroup,
  OperationLogEntityType.ChoiceCheck,
  OperationLogEntityType.Effect,
  OperationLogEntityType.Stat,
  OperationLogEntityType.StatStrength,
  OperationLogEntityType.StatRelation,
  OperationLogEntityType.Mode,
]);

export function resolveEntityIdentifierTypeAlias(
  value: string,
): OperationLogEntityType | undefined {
  const entityType = resolveEntityTypeAlias(value);
  return entityType && LEGACY_IDENTIFIER_ENTITY_TYPES.has(entityType) ? entityType : undefined;
}
