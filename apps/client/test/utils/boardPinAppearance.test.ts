/**
 * @jest-environment node
 */
import {
  boardPinAppearanceType,
  boardPinTypeKey,
} from '../../src/utils/boardPinAppearance';

it('treats a Chapter pin as an Event when the live row is an event', () => {
  expect(boardPinAppearanceType('entity', 'Chapter', 'event')).toBe('Event');
  expect(boardPinAppearanceType('entity', 'Chapter', 'chapter')).toBe('Chapter');
  expect(boardPinTypeKey('entity', 'Chapter', 'event')).toBe('event');
  expect(boardPinTypeKey('entity', 'Chapter', 'chapter')).toBe('chapter');
});
