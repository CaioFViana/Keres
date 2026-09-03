import {
  derivedId,
  packId,
  type PackLanguage,
  type ShippedPackDefinition,
} from './shippedPackDefinitions';

/**
 * Builds one shipped pack's content file.
 *
 * Separate from the script that writes it so a test can rebuild in memory and compare against what
 * is committed. Content files are generated, and a definition edited without rerunning the builder
 * would otherwise ship stale packs that nothing would notice.
 */

/** Keres authors these, and says so. The field is editable once installed, like any other. */
const AUTHOR_NAME = 'Keres';

/**
 * A fixed instant rather than `new Date()`.
 *
 * Regenerating must produce no diff, and a shipped pack has no creation moment worth recording -
 * it is content, not an event. The remap on install gives the copy its own dates anyway.
 */
const EPOCH = '2026-01-01T00:00:00.000Z';

const rowDates = {
  createdAt: EPOCH,
  updatedAt: EPOCH,
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

export function buildPack(definition: ShippedPackDefinition, language: PackLanguage) {
  const id = packId(definition.code, language);
  // Every row a pack carries belongs to a story; these belong to no story, so they share the
  // pack's own id. It is remapped away on install like every other id in the payload.
  const storyId = id;

  const fields = definition.fields.map((field, index) => ({
    id: derivedId(definition.code, language, 'F', index),
    storyId,
    entityType: field.entityType,
    name: field.name[language],
    key: field.key,
    description: field.description ? field.description[language] : null,
    type: field.type,
    targetEntityType: field.targetEntityType ?? null,
    isRequired: false,
    defaultValue: null,
    order: index,
    ...rowDates,
  }));

  const suggestions: Array<Record<string, unknown>> = [];
  definition.fields.forEach((field, fieldIndex) => {
    field.options?.forEach((option, optionIndex) => {
      suggestions.push({
        // Unique across the pack: the field's position and the option's, not the option's alone.
        id: derivedId(definition.code, language, 'S', fieldIndex * 20 + optionIndex),
        storyId,
        type: `custom:${fields[fieldIndex].id}`,
        value: option[language],
        ...rowDates,
      });
    });
  });

  const stats = definition.stats.map((stat, index) => ({
    id: derivedId(definition.code, language, 'T', index),
    storyId,
    name: stat.name[language],
    isPrimary: true,
    order: index,
    ...rowDates,
  }));

  const statStrengths = definition.ladder.map((rung, index) => ({
    id: derivedId(definition.code, language, 'L', index),
    storyId,
    // The story's default ladder: shared by every axis, rather than six copies of one ladder.
    statId: null,
    label: rung.label[language],
    minValue: rung.minValue,
    ...rowDates,
  }));

  const vocabulary = {
    version: 1 as const,
    language,
    terms: Object.fromEntries(
      Object.entries(definition.vocabulary).map(([entityType, term]) => [
        entityType,
        {
          singular: term.singular[language],
          plural: term.plural[language],
          grammaticalGender: term.grammaticalGender[language],
        },
      ]),
    ),
  };

  return {
    id,
    name: definition.name[language],
    description: definition.description[language],
    authorName: AUTHOR_NAME,
    version: 1,
    content: {
      formatVersion: 1,
      storySchemaFields: fields,
      suggestions,
      tags: [],
      stats,
      statStrengths,
      settings: {
        statSystem: definition.statSystem,
        statNotation: definition.statNotation,
        vocabulary,
      },
    },
  };
}

export type ShippedPackFile = ReturnType<typeof buildPack>;
