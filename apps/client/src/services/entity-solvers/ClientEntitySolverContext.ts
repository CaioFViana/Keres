import type { EntitySolverContext, EntitySolverRow } from '@keres/shared';
import { OperationLogEntityType } from '@keres/shared';
import type { StoryVocabularyEntityType } from '@keres/shared/entities/Story';
import { and, eq } from 'drizzle-orm';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { getEntityTable } from '../entityTableRegistry';
import {
  loadStoryVocabulary,
  fromStoryNoun,
  translateStoryNoun,
  unknownStoryNoun,
} from '../../vocabulary/storyVocabularyLookup';

const VOCABULARY_TYPES = new Set<OperationLogEntityType | 'Event'>([
  OperationLogEntityType.StoryArc,
  OperationLogEntityType.Character,
  OperationLogEntityType.Location,
  OperationLogEntityType.WorldRule,
  OperationLogEntityType.Chapter,
  OperationLogEntityType.Scene,
  OperationLogEntityType.Item,
  OperationLogEntityType.Choice,
  'Event',
]);

const vocabularyType = (type: OperationLogEntityType | 'Event'): StoryVocabularyEntityType => {
  if (type === 'Event') return 'Event';
  if (type === OperationLogEntityType.StoryArc) return 'Arc';
  return type as StoryVocabularyEntityType;
};

const translationKey: Partial<Record<OperationLogEntityType, string>> = {
  [OperationLogEntityType.Board]: 'board',
  [OperationLogEntityType.Story]: 'story',
  [OperationLogEntityType.Route]: 'route',
  [OperationLogEntityType.Note]: 'note',
  [OperationLogEntityType.LocationMap]: 'location_map',
  [OperationLogEntityType.Tag]: 'tag',
  [OperationLogEntityType.Gallery]: 'gallery',
  [OperationLogEntityType.Plot]: 'plots_title',
  [OperationLogEntityType.Stat]: 'stat',
  [OperationLogEntityType.Mode]: 'mode',
  [OperationLogEntityType.User]: 'user',
};

const OPERATION_LOG_ONLY_TABLES: Partial<Record<OperationLogEntityType, unknown>> = {
  [OperationLogEntityType.AttributeValue]: schema.attributeValues,
  [OperationLogEntityType.ChoiceCheck]: schema.choiceChecks,
  [OperationLogEntityType.ChoiceCheckGroup]: schema.choiceCheckGroups,
  [OperationLogEntityType.Comment]: schema.comments,
  [OperationLogEntityType.Effect]: schema.effects,
  [OperationLogEntityType.Favorite]: schema.favorites,
  [OperationLogEntityType.OperationLog]: schema.operationLogs,
  [OperationLogEntityType.StorySchemaField]: schema.storySchemaFields,
  [OperationLogEntityType.User]: schema.users,
};

/** SQLite implementation of the portable entity-solver read/translation port. */
export function createClientEntitySolverContext(
  db: AppDrizzleClient,
  storyId: string,
  t: TFunction,
): EntitySolverContext {
  let vocabularyPromise: ReturnType<typeof loadStoryVocabulary> | undefined;
  const vocabulary = () => (vocabularyPromise ??= loadStoryVocabulary(db, storyId));

  return {
    storyId,
    async read(type, id): Promise<EntitySolverRow | undefined> {
      const table = getEntityTable(type) ?? OPERATION_LOG_ONLY_TABLES[type];
      if (!table || !id) return undefined;
      const idColumn =
        type === OperationLogEntityType.User ? (table as any).idUser : (table as any).id;
      const conditions = [eq(idColumn, id)];
      if (type === OperationLogEntityType.Story) {
        conditions.push(eq((table as any).id, storyId));
      } else if (type !== OperationLogEntityType.User) {
        conditions.push(eq((table as any).storyId, storyId));
      }
      if (type !== OperationLogEntityType.OperationLog) {
        conditions.push(eq((table as any).isDeleted, false));
      }
      return (await db
        .select()
        .from(table as any)
        .where(and(...conditions))
        .get()) as EntitySolverRow | undefined;
    },
    translate(key, values) {
      return t(key, values);
    },
    async noun(type, plural = false) {
      if (VOCABULARY_TYPES.has(type)) {
        return translateStoryNoun(t, await vocabulary(), vocabularyType(type) as any, plural);
      }
      return t(translationKey[type as OperationLogEntityType] ?? 'unknown_entity_type');
    },
    async fromNoun(type) {
      if (VOCABULARY_TYPES.has(type)) {
        return fromStoryNoun(t, await vocabulary(), vocabularyType(type) as any);
      }
      return t(translationKey[type as OperationLogEntityType] ?? 'unknown_entity_type');
    },
    async unknownNoun(type) {
      if (VOCABULARY_TYPES.has(type)) {
        return unknownStoryNoun(t, await vocabulary(), vocabularyType(type) as any);
      }
      return t('unknown_entity');
    },
  };
}
