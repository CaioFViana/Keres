import { AttributeType, decodeAttributeValue, isValidAttributeDate } from '@keres/shared';
import type { NavigableEntityType } from '../entityNavigation';
import {
  buildFinding,
  type AnalysisEntityRef,
  type StoryAnalysisFinding,
  type StoryAnalysisInput,
} from './types';

export function checkCharacters(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const charactersWithScenes = new Set(input.characterScenes.map((cs) => cs.characterId));
  const charactersWithRelations = new Set<string>();
  for (const relation of input.characterRelations) {
    charactersWithRelations.add(relation.character1Id);
    charactersWithRelations.add(relation.character2Id);
  }

  for (const character of input.characters) {
    if (!charactersWithScenes.has(character.id)) {
      findings.push(
        buildFinding(
          'characters',
          'warning',
          'Character',
          character,
          'analysis_character_no_scenes',
        ),
      );
    }
    if (!charactersWithRelations.has(character.id)) {
      findings.push(
        buildFinding(
          'characters',
          'warning',
          'Character',
          character,
          'analysis_character_no_relationships',
        ),
      );
    }
  }

  return findings;
}

export function checkLocations(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  /*
   * A scene with no place uses no location, which is different from using one that is missing.
   * Filtering here rather than letting `null` into the set keeps "unused location" meaning what it
   * says.
   */
  const usedLocationIds = new Set(
    input.scenes.map((scene) => scene.locationId).filter((id): id is string => id !== null),
  );
  const connectedLocationIds = new Set<string>();
  for (const relation of input.locationRelations) {
    connectedLocationIds.add(relation.locationAId);
    connectedLocationIds.add(relation.locationBId);
  }

  for (const location of input.locations) {
    if (!usedLocationIds.has(location.id)) {
      findings.push(
        buildFinding('locations', 'warning', 'Location', location, 'analysis_location_unused'),
      );
    }
    if (!connectedLocationIds.has(location.id)) {
      findings.push(
        buildFinding(
          'locations',
          'warning',
          'Location',
          location,
          'analysis_location_no_connections',
        ),
      );
    }
  }

  return findings;
}

/**
 * Two rows describing the same link.
 *
 * A relation between two characters exists once, in whichever order the two ids happen to be stored;
 * two places are "contained in"/"connected to" one another once per type. `CharacterRelationService`
 * has always refused a duplicate, and since migration 0015 the database refuses one too - but a story
 * imported before that, or a package built elsewhere, can still be carrying them. They are reported
 * as errors, not warnings: the server's PostgreSQL rejects them, so a story holding one cannot
 * synchronize.
 */
export function checkDuplicateRelations(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const unorderedPair = (a: string, b: string) => (a <= b ? `${a} ${b}` : `${b} ${a}`);

  const characterName = new Map(
    input.characters.map((character) => [character.id, character.name]),
  );
  const seenCharacterPairs = new Set<string>();
  for (const relation of input.characterRelations) {
    const key = unorderedPair(relation.character1Id, relation.character2Id);
    if (!seenCharacterPairs.has(key)) {
      seenCharacterPairs.add(key);
      continue;
    }
    const character = input.characters.find((candidate) => candidate.id === relation.character1Id);
    if (!character) continue;
    findings.push(
      buildFinding(
        'characters',
        'error',
        'Character',
        character,
        'analysis_duplicate_character_relation',
        {
          otherName: characterName.get(relation.character2Id) ?? relation.character2Id,
        },
      ),
    );
  }

  const locationName = new Map(input.locations.map((location) => [location.id, location.name]));
  const seenLocationPairs = new Set<string>();
  for (const relation of input.locationRelations) {
    const key = `${unorderedPair(relation.locationAId, relation.locationBId)}${relation.relationType}`;
    if (!seenLocationPairs.has(key)) {
      seenLocationPairs.add(key);
      continue;
    }
    const location = input.locations.find((candidate) => candidate.id === relation.locationAId);
    if (!location) continue;
    findings.push(
      buildFinding(
        'locations',
        'error',
        'Location',
        location,
        'analysis_duplicate_location_relation',
        {
          otherName: locationName.get(relation.locationBId) ?? relation.locationBId,
        },
      ),
    );
  }

  return findings;
}

export function checkItems(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedItemIds = new Set(input.itemJourneys.map((j) => j.itemId));
  return input.items
    .filter((item) => !usedItemIds.has(item.id))
    .map((item) => buildFinding('items', 'warning', 'Item', item, 'analysis_item_unused'));
}

export function checkTags(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedTagIds = new Set(input.tagRelations.map((r) => r.tagId));
  return input.tags
    .filter((tag) => !usedTagIds.has(tag.id))
    .map((tag) => buildFinding('tags', 'warning', 'Tag', tag, 'analysis_tag_unused'));
}

const STORY_SCHEMA_ENTITY_TYPE_TO_NAVIGABLE: Record<string, NavigableEntityType> = {
  Character: 'Character',
  Location: 'Location',
  Item: 'Item',
  Scene: 'Scene',
  Chapter: 'Chapter',
  Note: 'Note',
  WorldRule: 'WorldRule',
};

/**
 * Required attributes left empty, and values that make no sense for the declared type. "Invalid" is only
 * checked for number/date - `decodeAttributeValue` makes a boolean always turn into a valid value (never
 * detectable as invalid by design, see `attributeValueCodec.ts`), and free text has no wrong shape.
 */
export function checkStorySchema(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];

  const entitiesByType: Record<string, AnalysisEntityRef[]> = {
    Character: input.characters,
    Location: input.locations,
    Item: input.items,
    Scene: input.scenes.map((s) => ({ id: s.id, name: s.name })),
    Chapter: input.chapters,
    Note: input.notes,
    WorldRule: input.worldRules,
  };

  const rawValueByFieldAndEntity = new Map<string, string | null>();
  for (const value of input.attributeValues) {
    rawValueByFieldAndEntity.set(`${value.fieldId}:${value.entityId}`, value.value);
  }

  for (const field of input.storySchemaFields) {
    const navigableType = STORY_SCHEMA_ENTITY_TYPE_TO_NAVIGABLE[field.entityType];
    const entities = entitiesByType[field.entityType];
    if (!navigableType || !entities) continue;

    for (const entity of entities) {
      const raw = rawValueByFieldAndEntity.get(`${field.id}:${entity.id}`) ?? null;
      const decoded = decodeAttributeValue(field.type as AttributeType, raw);

      if (field.isRequired && decoded === null) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_required_missing',
            { fieldName: field.name },
          ),
        );
        continue;
      }

      if (
        field.type === AttributeType.ENTITY &&
        raw !== null &&
        (!field.targetEntityType ||
          !entitiesByType[field.targetEntityType]?.some((target) => target.id === raw))
      ) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_entity_missing',
            { fieldName: field.name },
          ),
        );
        continue;
      }

      if (!raw) continue;

      const isInvalid =
        field.type === AttributeType.NUMBER
          ? decoded === null
          : field.type === AttributeType.DATE
            ? // `Date.parse` continua como segunda chance de propósito: só o formato canônico
              // (`attributeDateValue.ts`) is accepted straight away, but free-text values saved before the date picker
              // existed must not all turn into warnings at once.
              !isValidAttributeDate(raw) && Number.isNaN(Date.parse(raw))
            : false;

      if (isInvalid) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_invalid',
            {
              fieldName: field.name,
            },
          ),
        );
      }
    }
  }

  return findings;
}
