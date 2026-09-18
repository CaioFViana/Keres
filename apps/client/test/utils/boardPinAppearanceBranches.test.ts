/**
 * @jest-environment node
 */
import { getEntityAppearance, getWorldPieceSectionAppearance } from '@keres/shared';
import {
  boardPinAccent,
  boardPinAppearanceType,
  boardPinIcon,
  boardPinTypeKey,
  getBoardPinAppearance,
  worldPieceSectionFromBoardPinGroup,
} from '../../src/utils/boardPinAppearance';

describe('boardPinAppearanceType', () => {
  it('treats free notes as notes regardless of entity data', () => {
    expect(boardPinAppearanceType('note', 'Location', 'event')).toBe('Note');
    expect(boardPinAppearanceType('note')).toBe('Note');
  });

  it('defaults entity pins to characters', () => {
    expect(boardPinAppearanceType('entity')).toBe('Character');
    expect(boardPinAppearanceType('entity', 'Location')).toBe('Location');
  });
});

describe('getBoardPinAppearance', () => {
  it('matches the entity appearance for ordinary pins', () => {
    expect(getBoardPinAppearance('note')).toEqual(getEntityAppearance('Note'));
    expect(getBoardPinAppearance('entity', 'Location')).toEqual(getEntityAppearance('Location'));
    expect(boardPinAccent('entity', 'Item')).toBe(getEntityAppearance('Item').color);
    expect(boardPinIcon('entity', 'Item')).toBe(getEntityAppearance('Item').icon);
  });

  it('matches the section appearance for world-piece pins', () => {
    expect(getBoardPinAppearance('entity', 'WorldRule', 'worldrule:fauna')).toEqual(
      getWorldPieceSectionAppearance('fauna'),
    );
  });

  it('falls back to the entity appearance for unknown groups', () => {
    expect(getBoardPinAppearance('entity', 'WorldRule', 'worldrule:unknown')).toEqual(
      getEntityAppearance('WorldRule'),
    );
  });
});

describe('worldPieceSectionFromBoardPinGroup', () => {
  it('rejects missing and non-world-piece groups', () => {
    expect(worldPieceSectionFromBoardPinGroup(undefined)).toBeNull();
    expect(worldPieceSectionFromBoardPinGroup('event')).toBeNull();
    expect(worldPieceSectionFromBoardPinGroup('worldrule:')).toBeNull();
  });
});

describe('boardPinTypeKey', () => {
  it.each([
    ['Character', 'character'],
    ['Location', 'location'],
    ['Scene', 'scene'],
    ['Item', 'item'],
    ['Gallery', 'gallery'],
    ['Chapter', 'chapter'],
    ['WorldRule', 'world_rule'],
    ['Board', 'board'],
    ['Event', 'event'],
    ['Note', 'note'],
  ] as const)('maps %s pins to %s', (entityType: any, expected) => {
    expect(boardPinTypeKey('entity', entityType)).toBe(expected);
  });

  it('distinguishes free notes from note pins', () => {
    expect(boardPinTypeKey('note')).toBe('board_note');
    expect(boardPinTypeKey('entity', 'Note')).toBe('note');
  });

  it('falls back to board notes for unknown types', () => {
    expect(boardPinTypeKey('entity', 'SomethingElse' as any)).toBe('board_note');
  });
});
