import { describe, expect, it } from 'vitest';
import {
  getStorySyncEntityTypes,
  getTierCountedEntityTypes,
  getTierRelationalEntityTypes,
  TIER_EXEMPT_ENTITY_TYPES,
  TIER_RELATIONAL_ENTITY_TYPES,
} from '../../index';

/**
 * A plan counts what the writer creates. Everything a story synchronizes is in exactly one of three
 * places: not counted at all (the story, favorites, comments), only linking or filling in other
 * entities (shown, never counted), or counted.
 */
describe('which entities a plan counts', () => {
  const synchronized = getStorySyncEntityTypes();

  it('names only types a story synchronizes', () => {
    for (const type of [...TIER_EXEMPT_ENTITY_TYPES, ...TIER_RELATIONAL_ENTITY_TYPES]) {
      expect(synchronized).toContain(type);
    }
  });

  it('puts every synchronized type in exactly one of the three groups', () => {
    const counted = new Set<string>(getTierCountedEntityTypes());
    const relational = new Set<string>(getTierRelationalEntityTypes());
    const exempt = new Set<string>(TIER_EXEMPT_ENTITY_TYPES);

    for (const type of synchronized) {
      const groups = [counted.has(type), relational.has(type), exempt.has(type)].filter(Boolean);
      expect([type, groups.length]).toEqual([type, 1]);
    }
    expect(counted.size + relational.size + exempt.size).toBe(synchronized.length);
  });

  it('does not count links between entities, nor the values of custom fields and stats', () => {
    const counted = getTierCountedEntityTypes();

    for (const type of [
      'CharacterRelation',
      'LocationRelation',
      'NoteRelation',
      'TagRelation',
      'GalleryRelation',
      'SeeAlsoRelation',
      'CharacterScene',
      'PlotScene',
      'RouteStep',
      'ItemJourney',
      'AttributeValue',
      'StatRelation',
    ]) {
      expect(counted).not.toContain(type);
      expect(getTierRelationalEntityTypes()).toContain(type);
    }
  });

  it('counts what the writer defines: custom fields and stats with their ladder levels', () => {
    const counted = getTierCountedEntityTypes();

    for (const type of [
      'Character',
      'Scene',
      'Location',
      'Chapter',
      'StorySchemaField',
      'Stat',
      'StatStrength',
    ]) {
      expect(counted).toContain(type);
    }
  });

  it('never counts the story, favorites and comments', () => {
    for (const type of TIER_EXEMPT_ENTITY_TYPES) {
      expect(getTierCountedEntityTypes()).not.toContain(type);
      expect(getTierRelationalEntityTypes()).not.toContain(type);
    }
  });
});
