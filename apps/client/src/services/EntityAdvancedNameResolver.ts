import { OperationLogEntityType } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import {
  characters,
  choiceCheckGroups,
  choiceChecks,
  choices,
  comments,
  effects,
  items,
  modes,
  seeAlsoRelations,
  statRelations,
  stats,
  statStrengths,
  storySchemaFields,
} from '../db/schemas';
import { resolveRelationEntityName } from './EntityIdentifierResolver';

const EFFECT_TYPE_LABEL_KEYS: Record<string, string> = {
  itemGrant: 'effect_item_grant',
  itemTake: 'effect_item_take',
  triggerSet: 'effect_trigger_set',
  triggerUnset: 'effect_trigger_unset',
};

export async function resolveAdvancedEntityName(
  db: AppDrizzleClient,
  entityType: OperationLogEntityType,
  entityId: string,
  storyId: string,
  t: TFunction,
): Promise<string | undefined> {
  let translatedEntityType: string | undefined;
  let entitySpecificName: string | undefined;

  switch (entityType) {
    case OperationLogEntityType.SeeAlsoRelation:
      const seeAlsoRelation = await db.query.seeAlsoRelations.findFirst({
        where: and(
          eq(seeAlsoRelations.id, entityId),
          eq(seeAlsoRelations.storyId, storyId),
          eq(seeAlsoRelations.isDeleted, false),
        ),
        columns: { entityAType: true, entityAId: true, entityBType: true, entityBId: true },
      });
      if (seeAlsoRelation) {
        const sideA = await resolveRelationEntityName(
          db,
          seeAlsoRelation.entityAType as OperationLogEntityType,
          seeAlsoRelation.entityAId,
          storyId,
          t,
        );
        const sideB = await resolveRelationEntityName(
          db,
          seeAlsoRelation.entityBType as OperationLogEntityType,
          seeAlsoRelation.entityBId,
          storyId,
          t,
        );
        entitySpecificName = `${sideA.name || t('unknown_entity')} (${sideA.type || t('unknown_entity_type')}) - ${sideB.name || t('unknown_entity')} (${sideB.type || t('unknown_entity_type')})`;
      }
      translatedEntityType = t('see_also_relation');
      break;
    case OperationLogEntityType.Comment:
      const comment = await db.query.comments.findFirst({
        where: and(
          eq(comments.id, entityId),
          eq(comments.storyId, storyId),
          eq(comments.isDeleted, false),
        ),
        columns: {
          entityType: true,
          entityId: true,
          fieldId: true,
          fieldKey: true,
          commentText: true,
        },
      });
      if (comment) {
        const target = await resolveRelationEntityName(
          db,
          comment.entityType as OperationLogEntityType,
          comment.entityId,
          storyId,
          t,
        );
        let fieldLabel = comment.fieldKey || '';
        if (comment.fieldId) {
          const field = await db.query.storySchemaFields.findFirst({
            where: eq(storySchemaFields.id, comment.fieldId),
            columns: { name: true },
          });
          fieldLabel = field?.name || fieldLabel;
        }
        const snippet =
          comment.commentText.length > 60
            ? `${comment.commentText.slice(0, 60)}...`
            : comment.commentText;
        entitySpecificName = `${target.name || t('unknown_entity')} (${target.type || t('unknown_entity_type')}) - ${fieldLabel}: "${snippet}"`;
      }
      translatedEntityType = t('comment');
      break;
    case OperationLogEntityType.ChoiceCheckGroup:
      const choiceCheckGroup = await db.query.choiceCheckGroups.findFirst({
        where: and(eq(choiceCheckGroups.id, entityId), eq(choiceCheckGroups.isDeleted, false)),
        columns: { choiceId: true },
      });
      if (choiceCheckGroup) {
        const groupChoice = await db.query.choices.findFirst({
          where: and(eq(choices.id, choiceCheckGroup.choiceId), eq(choices.isDeleted, false)),
          columns: { text: true },
        });
        entitySpecificName = groupChoice?.text || t('unknown_choice');
      }
      translatedEntityType = t('choice_check_group');
      break;
    case OperationLogEntityType.ChoiceCheck:
      const choiceCheck = await db.query.choiceChecks.findFirst({
        where: and(eq(choiceChecks.id, entityId), eq(choiceChecks.isDeleted, false)),
        columns: { groupId: true },
      });
      if (choiceCheck) {
        const checkGroup = await db.query.choiceCheckGroups.findFirst({
          where: and(
            eq(choiceCheckGroups.id, choiceCheck.groupId),
            eq(choiceCheckGroups.isDeleted, false),
          ),
          columns: { choiceId: true },
        });
        const checkChoice = checkGroup
          ? await db.query.choices.findFirst({
              where: and(eq(choices.id, checkGroup.choiceId), eq(choices.isDeleted, false)),
              columns: { text: true },
            })
          : undefined;
        entitySpecificName = checkChoice?.text || t('unknown_choice');
      }
      translatedEntityType = t('choice_check');
      break;
    case OperationLogEntityType.Effect:
      const effect = await db.query.effects.findFirst({
        where: and(eq(effects.id, entityId), eq(effects.isDeleted, false)),
        columns: { effectType: true, itemId: true, triggerName: true },
      });
      if (effect) {
        const effectLabel = t(EFFECT_TYPE_LABEL_KEYS[effect.effectType] || effect.effectType);
        let target: string | undefined;
        if (effect.effectType === 'itemGrant' || effect.effectType === 'itemTake') {
          const effectItem = effect.itemId
            ? await db.query.items.findFirst({
                where: and(eq(items.id, effect.itemId), eq(items.isDeleted, false)),
                columns: { name: true },
              })
            : undefined;
          target = effectItem?.name || t('unknown_item');
        } else {
          target = effect.triggerName || t('unknown_trigger');
        }
        entitySpecificName = `${effectLabel}: ${target}`;
      }
      translatedEntityType = t('effect');
      break;
    case OperationLogEntityType.Stat:
      const stat = await db.query.stats.findFirst({
        where: and(eq(stats.id, entityId), eq(stats.isDeleted, false)),
        columns: { name: true },
      });
      entitySpecificName = stat?.name;
      translatedEntityType = t('stat');
      break;
    case OperationLogEntityType.Mode:
      const mode = await db.query.modes.findFirst({
        where: and(eq(modes.id, entityId), eq(modes.isDeleted, false)),
        columns: { name: true, characterId: true },
      });
      if (mode) {
        const modeOwner = await db.query.characters.findFirst({
          where: and(eq(characters.id, mode.characterId), eq(characters.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = t('mode_of_character', {
          modename: mode.name,
          charactername: modeOwner?.name || t('unknown_character'),
        });
      }
      translatedEntityType = t('mode');
      break;
    case OperationLogEntityType.StatStrength:
      const statStrength = await db.query.statStrengths.findFirst({
        where: and(eq(statStrengths.id, entityId), eq(statStrengths.isDeleted, false)),
        columns: { statId: true, label: true, minValue: true },
      });
      if (statStrength) {
        // A null `statId` is the story's default ladder, which belongs to no stat.
        const ladderStat = statStrength.statId
          ? await db.query.stats.findFirst({
              where: and(eq(stats.id, statStrength.statId), eq(stats.isDeleted, false)),
              columns: { name: true },
            })
          : undefined;
        const ladderName = statStrength.statId
          ? t('stat_ladder_of_stat', { statname: ladderStat?.name || t('unknown_stat') })
          : t('stat_ladder_story_default');
        entitySpecificName = `${ladderName} - ${statStrength.label} (${statStrength.minValue})`;
      }
      translatedEntityType = t('stat_strength');
      break;
    case OperationLogEntityType.StatRelation:
      const statRelation = await db.query.statRelations.findFirst({
        where: and(eq(statRelations.id, entityId), eq(statRelations.isDeleted, false)),
        columns: { characterId: true, modeId: true, statId: true, value: true },
      });
      if (statRelation) {
        const valueStat = await db.query.stats.findFirst({
          where: and(eq(stats.id, statRelation.statId), eq(stats.isDeleted, false)),
          columns: { name: true },
        });
        const valueOwner = await db.query.characters.findFirst({
          where: and(eq(characters.id, statRelation.characterId), eq(characters.isDeleted, false)),
          columns: { name: true },
        });
        const valueMode = statRelation.modeId
          ? await db.query.modes.findFirst({
              where: and(eq(modes.id, statRelation.modeId), eq(modes.isDeleted, false)),
              columns: { name: true },
            })
          : undefined;
        const ownerName = valueMode
          ? `${valueOwner?.name || t('unknown_character')} · ${valueMode.name}`
          : valueOwner?.name || t('unknown_character');
        entitySpecificName = `${t('stat_value_of_entity', {
          statname: valueStat?.name || t('unknown_stat'),
          entityname: ownerName,
        })}: ${statRelation.value}`;
      }
      translatedEntityType = t('stat_relation');
      break;

    default:
      return undefined;
  }
  return entitySpecificName
    ? `${translatedEntityType} - ${entitySpecificName}`
    : translatedEntityType;
}
