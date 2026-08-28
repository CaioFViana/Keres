import type { BoardPinEntity } from '@keres/shared';

/** Accent on the pin so a Character and a Location do not look like the same card with a different icon. */
export const BOARD_PIN_ACCENT: Record<BoardPinEntity | 'note', string> = {
  Character: '#3D5A80',
  Location: '#2A9D8F',
  Scene: '#6C63FF',
  Item: '#E76F51',
  Gallery: '#9B5DE5',
  Chapter: '#4D749E',
  Note: '#C9A227',
  note: '#B08900',
};

export function boardPinAccent(kind: 'note' | 'entity', entityType?: BoardPinEntity): string {
  if (kind === 'note') return BOARD_PIN_ACCENT.note;
  return BOARD_PIN_ACCENT[entityType ?? 'Character'];
}

export function boardPinTypeKey(kind: 'note' | 'entity', entityType?: BoardPinEntity): string {
  if (kind === 'note') return 'board_note';
  switch (entityType) {
    case 'Character':
      return 'character';
    case 'Location':
      return 'location';
    case 'Scene':
      return 'scene';
    case 'Item':
      return 'item';
    case 'Gallery':
      return 'gallery';
    case 'Chapter':
      return 'chapter';
    case 'Note':
      return 'note';
    default:
      return 'board_note';
  }
}
