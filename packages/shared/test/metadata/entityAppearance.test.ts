import { describe, expect, it } from 'vitest';
import {
  ENTITY_APPEARANCE,
  OperationLogEntityType,
  WORLD_PIECE_SECTION_APPEARANCE,
  getContrastRatio,
  getContrastTextColor,
} from '../../index';

const RELATION_OPERATION_LOG_ENTITY_TYPES = new Set<OperationLogEntityType>([
  OperationLogEntityType.CharacterRelation,
  OperationLogEntityType.CharacterScene,
  OperationLogEntityType.GalleryRelation,
  OperationLogEntityType.LocationRelation,
  OperationLogEntityType.NoteRelation,
  OperationLogEntityType.PlotScene,
  OperationLogEntityType.SeeAlsoRelation,
  OperationLogEntityType.StatRelation,
  OperationLogEntityType.TagRelation,
]);

describe('entity appearance palettes', () => {
  it('gives Story and StoryCalendar distinct icons instead of the generic fallback', () => {
    // This was from before the test below, that checks all entities to have icons.
    expect(ENTITY_APPEARANCE.Story.icon).toBe('book');
    expect(ENTITY_APPEARANCE.StoryCalendar.icon).toBe('calendar');
  });

  it('covers every direct operation-log entity with an explicit appearance', () => {
    const directEntityTypes = Object.values(OperationLogEntityType).filter(
      (entityType) => !RELATION_OPERATION_LOG_ENTITY_TYPES.has(entityType),
    );

    expect(Object.keys(ENTITY_APPEARANCE)).toEqual(expect.arrayContaining(directEntityTypes));
  });

  it('keeps every theme variant readable with its chosen black or white foreground', () => {
    const colors = [
      ...Object.values(ENTITY_APPEARANCE).flatMap(({ light, dark }) => [light, dark]),
      ...Object.values(WORLD_PIECE_SECTION_APPEARANCE).flatMap(({ light, dark }) => [light, dark]),
    ];

    for (const color of colors) {
      const foreground = getContrastTextColor(color) === 'black' ? '#000000' : '#FFFFFF';
      expect(getContrastRatio(color, foreground), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('puts white on every light-theme entity and world-piece colour, never a mix', () => {
    // Readable per colour is not enough: mid-tone swatches where black happens to edge out white
    // made the dashboard tiles alternate between white and black labels.
    const offenders = [
      ...Object.entries(ENTITY_APPEARANCE).map(([name, { light }]) => [name, light] as const),
      ...Object.entries(WORLD_PIECE_SECTION_APPEARANCE).map(
        ([name, { light }]) => [name, light] as const,
      ),
    ].filter(([, color]) => getContrastTextColor(color) !== 'white');

    expect(offenders).toEqual([]);
  });

  it('puts black on every dark-theme colour the dashboard tiles use, never a mix', () => {
    const tiles = [
      'Chapter',
      'Scene',
      'Location',
      'Character',
      'Note',
      'WorldRule',
      'Item',
      'Gallery',
      'Tag',
      'StorySchemaField',
      'Choice',
      'Fork',
    ] as const;

    expect(
      tiles.filter((name) => getContrastTextColor(ENTITY_APPEARANCE[name].dark) !== 'black'),
    ).toEqual([]);
  });

  it('uses dark text for the lighter dark-theme tile variants', () => {
    for (const entityType of ['Scene', 'Item', 'StorySchemaField'] as const) {
      expect(getContrastTextColor(ENTITY_APPEARANCE[entityType].dark)).toBe('black');
    }
  });
});
