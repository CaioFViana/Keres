/**
 * @jest-environment node
 */
import {
  boardPinAppearanceType,
  boardPinTypeKey,
  getBoardPinAppearance,
  worldPieceSectionFromBoardPinGroup,
} from '../../src/utils/boardPinAppearance';

it('treats a Chapter pin as an Event when the live row is an event', () => {
  expect(boardPinAppearanceType('entity', 'Chapter', 'event')).toBe('Event');
  expect(boardPinAppearanceType('entity', 'Chapter', 'chapter')).toBe('Chapter');
  expect(boardPinTypeKey('entity', 'Chapter', 'event')).toBe('event');
  expect(boardPinTypeKey('entity', 'Chapter', 'chapter')).toBe('chapter');
});

it('uses a World Piece section appearance for a board card', () => {
  expect(worldPieceSectionFromBoardPinGroup('worldrule:fauna')).toBe('fauna');
  expect(worldPieceSectionFromBoardPinGroup('worldrule:unknown')).toBeNull();
  expect(getBoardPinAppearance('entity', 'WorldRule', 'worldrule:fauna')).toMatchObject({
    icon: 'paw-outline',
    color: '#C62828',
  });
});
