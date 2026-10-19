import { describe, expect, it } from 'vitest';
import {
  getStorySyncEntityTypes,
  countTierEntitiesInStoryPackage,
  getTierCountedEntityTypes,
  getTierFreeEntityTypes,
  TIER_EXEMPT_ENTITY_TYPES,
  TIER_PART_ENTITY_TYPES,
  TIER_RELATIONAL_ENTITY_TYPES,
} from '../../index';

/**
 * A plan counts what the writer creates. Everything a story synchronizes is in exactly one of three
 * places: not counted at all (the story, favorites, comments), free (links and values, parts and
 * consequences, configuration, media files: shown, never counted), or counted.
 */
describe('which entities a plan counts', () => {
  const synchronized = getStorySyncEntityTypes();

  it('names only types a story synchronizes', () => {
    for (const type of [
      ...TIER_EXEMPT_ENTITY_TYPES,
      ...TIER_RELATIONAL_ENTITY_TYPES,
      ...TIER_PART_ENTITY_TYPES,
    ]) {
      expect(synchronized).toContain(type);
    }
  });

  it('puts every synchronized type in exactly one of the three groups', () => {
    const counted = new Set<string>(getTierCountedEntityTypes());
    const free = new Set<string>(getTierFreeEntityTypes());
    const exempt = new Set<string>(TIER_EXEMPT_ENTITY_TYPES);

    for (const type of synchronized) {
      const groups = [counted.has(type), free.has(type), exempt.has(type)].filter(Boolean);
      expect([type, groups.length]).toEqual([type, 1]);
    }
    expect(counted.size + free.size + exempt.size).toBe(synchronized.length);
  });

  it('counts exactly the nineteen types a plan has always meant by an entity', () => {
    // Pinned by name on purpose: changing what a plan counts must be a deliberate edit of this list.
    expect([...getTierCountedEntityTypes()].sort()).toEqual(
      [
        'Board',
        'Character',
        'Chapter',
        'Item',
        'Location',
        'LocationMap',
        'Mode',
        'Note',
        'Plot',
        'Route',
        'Scene',
        'Sketch',
        'Song',
        'Stat',
        'StoryArc',
        'StoryCalendar',
        'StorySchemaField',
        'Tag',
        'WorldRule',
      ].sort(),
    );
  });

  it('leaves the free types out of the count, by name', () => {
    expect([...getTierFreeEntityTypes()].sort()).toEqual(
      [
        'AttributeValue',
        'CharacterRelation',
        'CharacterScene',
        'Choice',
        'ChoiceCheck',
        'ChoiceCheckGroup',
        'ChapterAnchor',
        'Effect',
        'Gallery',
        'GalleryRelation',
        'ItemJourney',
        'LocationRelation',
        'NoteRelation',
        'PlotScene',
        'RouteStep',
        'SceneMusic',
        'ScenePage',
        'SeeAlsoRelation',
        'StatRelation',
        'StatStrength',
        'Suggestion',
        'TagRelation',
      ].sort(),
    );
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
      expect(getTierFreeEntityTypes()).toContain(type);
    }
  });

  it('does not count the parts of an entity, its consequences, its configuration, nor media files', () => {
    const counted = getTierCountedEntityTypes();

    for (const type of [
      'ScenePage',
      'SceneMusic',
      'ChoiceCheckGroup',
      'ChoiceCheck',
      'StatStrength',
      'Effect',
      'Choice',
      'ChapterAnchor',
      'Suggestion',
      'Gallery',
    ]) {
      expect(counted).not.toContain(type);
      expect(getTierFreeEntityTypes()).toContain(type);
    }
  });

  it('counts what the writer defines: characters, scenes, custom fields and stats', () => {
    const counted = getTierCountedEntityTypes();

    for (const type of ['Character', 'Scene', 'Location', 'Chapter', 'StorySchemaField', 'Stat']) {
      expect(counted).toContain(type);
    }
  });

  it('never counts the story, favorites and comments', () => {
    for (const type of TIER_EXEMPT_ENTITY_TYPES) {
      expect(getTierCountedEntityTypes()).not.toContain(type);
      expect(getTierFreeEntityTypes()).not.toContain(type);
    }
  });
});

describe('the entities of an uploaded package', () => {
  it('counts the live rows of the types a plan counts, and nothing else', () => {
    const counted = countTierEntitiesInStoryPackage({
      story: { id: 's' },
      characters: [{ id: 'a' }, { id: 'b' }, { id: 'c', isDeleted: true }],
      scenes: [{ id: 'x' }],
      // links between entities, parts, media files, favorites and comments are not counted by any plan
      characterRelations: [{ id: 'r1' }, { id: 'r2' }],
      scenePages: [{ id: 'p1' }, { id: 'p2' }],
      galleryItems: [{ id: 'g1' }],
      favorites: [{ id: 'f' }],
      comments: [{ id: 'k' }],
    });

    expect(counted).toBe(3);
  });

  it('reads a package with missing collections as the entities it does carry', () => {
    expect(countTierEntitiesInStoryPackage({})).toBe(0);
    expect(countTierEntitiesInStoryPackage({ notes: [{ id: 'n' }], songs: 'broken' })).toBe(1);
  });
});
