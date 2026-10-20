/**
 * @jest-environment node
 */
import {
  ENTITY_APPEARANCE,
  getStorySyncEntityTypes,
  getTierCountedEntityTypes,
  getTierFreeEntityTypes,
} from '@keres/shared';
import en from '@/src/locales/en.json';
import pt from '@/src/locales/pt.json';
import { registerClientSyncHandlers } from '@/src/services/sync/registerClientSyncHandlers';
import { isStoryVocabularyEntityType } from '@/src/vocabulary/resolveStoryTerm';
import { ENTITY_COUNT_LABEL_KEYS } from '@/src/utils/entity/entityCountLabels';

/**
 * What a new synchronized entity has to be given, beyond its table and its handlers. The registry
 * (`EntityRegistry.ts`) is the one list a new entity is added to; these are the places that quietly
 * degrade when it is forgotten, instead of failing: a grey placeholder icon, a raw English key on the
 * count screen, a type no device can apply. Each check names the type that is missing, so the failure
 * says what to add. The step-by-step is in `docs/procedures/adding_an_entity.md`.
 *
 * The tables, the export collections, the API handlers, the operation-log presentation and the
 * convergence fuzz have tests of their own (`entityTableRegistry`, `apiEntityTableRegistry`,
 * `operationLogResolverCoverage`, `SyncConvergenceCoverage`).
 */

const synced = getStorySyncEntityTypes();

/** Join rows between two entities: they are shown through their ends, never as an item of their own. */
const LINKS_WITHOUT_APPEARANCE = [
  'CharacterRelation',
  'CharacterScene',
  'GalleryRelation',
  'LocationRelation',
  'NoteRelation',
  'PlotScene',
  'SeeAlsoRelation',
  'StatRelation',
  'TagRelation',
];

describe('every synchronized entity type', () => {
  it('is found (the registry is not silently empty)', () => {
    expect(synced.length).toBeGreaterThan(40);
  });

  it('has a client sync handler', () => {
    const handlers = registerClientSyncHandlers();

    expect(synced.filter((type) => !handlers.has(type))).toEqual([]);
  });

  it('has its own icon and colour, not the grey placeholder', () => {
    const missing = synced.filter(
      (type) => !Object.hasOwn(ENTITY_APPEARANCE, type) && !LINKS_WITHOUT_APPEARANCE.includes(type),
    );

    expect(missing).toEqual([]);
  });

  it('is named on the entity count screen, in both languages, unless the story vocabulary names it', () => {
    const counted = [...getTierCountedEntityTypes(), ...getTierFreeEntityTypes()];
    const dictionaries = { en: en as Record<string, string>, pt: pt as Record<string, string> };
    const missing = counted.flatMap((type) => {
      if (isStoryVocabularyEntityType(type)) return [];
      const key = ENTITY_COUNT_LABEL_KEYS[type];
      if (!key) return [`${type}: no entry in ENTITY_COUNT_LABEL_KEYS`];
      return (Object.keys(dictionaries) as (keyof typeof dictionaries)[])
        .filter((language) => !dictionaries[language][key])
        .map((language) => `${type}: "${key}" is missing in ${language}.json`);
    });

    expect(missing).toEqual([]);
  });
});
